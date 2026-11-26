// Additive, retry-safe production migration for annual document review. Run only while the existing app is stopped and
// after the current NAS DB+storage backup has passed the laptop restore gate.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {ensureDocumentReviewSchema} from './document-review-schema.mjs';

const fromInspect = json => Object.fromEntries(json.Config.Env.map(entry => {
  const index = entry.indexOf('=');
  return [entry.slice(0, index), entry.slice(index + 1)];
}));
const counts = async connection => {
  const [[result]] = await connection.query(
    'SELECT (SELECT COUNT(*) FROM v2_documents) documents,(SELECT COUNT(*) FROM v2_versions) versions,(SELECT COUNT(*) FROM v2_files) files,(SELECT COUNT(*) FROM v2_audit) audit,(SELECT COUNT(*) FROM users) accounts');
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, String(value)]));
};

let admin;
let runtimeUser = null;
const rehearsal = process.env.REVIEW_MIGRATION_TEST === '1';
if (rehearsal) {
  admin = {host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME};
  assert.equal(process.env.DB_NAME, 'edms_ups');
} else {
  const adminEnv = fromInspect(JSON.parse(await fs.readFile('/admin-source.json', 'utf8'))[0]);
  const runtimeEnv = fromInspect(JSON.parse(await fs.readFile('/runtime-source.json', 'utf8'))[0]);
  assert.equal(adminEnv.DB_NAME, 'edms_ups');
  assert.equal(adminEnv.DB_USER, 'root');
  assert.equal(String(adminEnv.DB_PORT), '3307');
  assert(['host.docker.internal', '10.10.200.166'].includes(adminEnv.DB_HOST));
  assert.equal(runtimeEnv.DB_NAME, 'edms_ups');
  admin = {host: adminEnv.DB_HOST, port: 3307, user: adminEnv.DB_USER,
    password: adminEnv.DB_PASSWORD, database: adminEnv.DB_NAME};
  runtimeUser = runtimeEnv.DB_USER;
  assert(/^edms_v21_[a-f0-9]{12}$/.test(runtimeUser || ''), 'Unexpected runtime account; inspect before migration.');
}
assert(admin.password, 'Kredensial DB migrasi tidak tersedia.');

const connection = await mysql.createConnection({...admin, connectTimeout: 15000, multipleStatements: false});
try {
  if (!rehearsal) {
    const [clients] = await connection.query('SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()');
    assert.equal(clients.length, 0, 'Client DB lain masih aktif; aplikasi harus tetap berhenti.');
  }
  const [[ledger]] = await connection.query("SELECT COUNT(*) total FROM v2_migrations WHERE version='011'");
  const before = await counts(connection);
  let grantsBefore = [];
  if (runtimeUser) {
    const [account] = await connection.query('SELECT User FROM mysql.user WHERE User=? AND Host=?', [runtimeUser, '%']);
    assert.equal(account.length, 1, 'Akun runtime lama tidak ditemukan.');
    const grantee = "'" + runtimeUser + "'@'%'";
    const [grants] = await connection.query('SELECT PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY PRIVILEGE_TYPE', [grantee, 'edms_ups', 'v2_documents']);
    grantsBefore = grants.map(row => row.PRIVILEGE_TYPE);
    assert(grantsBefore.includes('SELECT') && grantsBefore.includes('UPDATE'), 'Hak runtime pada v2_documents tidak cukup sebelum update.');
  }

  const schema = await ensureDocumentReviewSchema(connection);
  assert.deepEqual(await ensureDocumentReviewSchema(connection), schema, 'Pengulangan migrasi tidak idempoten.');
  await connection.query("INSERT IGNORE INTO v2_migrations(version,detail) VALUES('011','Annual document review tracking; records preserved')");
  const [[afterLedger]] = await connection.query("SELECT COUNT(*) total FROM v2_migrations WHERE version='011'");
  assert.equal(Number(afterLedger.total), 1, 'Migration 011 tidak tercatat.');
  assert.equal(await counts(connection).then(value => JSON.stringify(value)), JSON.stringify(before), 'Jumlah akun, dokumen, versi, file, atau audit berubah.');

  let grantsAfter = [];
  if (runtimeUser) {
    const grantee = "'" + runtimeUser + "'@'%'";
    const [grants] = await connection.query('SELECT PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY PRIVILEGE_TYPE', [grantee, 'edms_ups', 'v2_documents']);
    grantsAfter = grants.map(row => row.PRIVILEGE_TYPE);
    assert.deepEqual(grantsAfter, grantsBefore, 'Hak runtime berubah selama migrasi.');
  }
  console.log('REVIEW_MIGRATION_PASS ' + JSON.stringify({rehearsal, schema, alreadyRecorded: Number(ledger.total) > 0,
    idempotencyVerified: true, counts: before, runtimeGrantsPreserved: runtimeUser ? grantsAfter : 'not applicable'}));
} finally {
  await connection.end();
}
