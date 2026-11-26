const read = async (connection, sql, params = []) => (await connection.query(sql, params))[0];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function ensureDocumentReviewSchema(connection) {
  const dependencies = await read(connection, "SELECT version FROM v2_migrations WHERE version IN ('001','002')");
  assert(dependencies.length === 2, 'Schema fondasi 001/002 belum lengkap untuk review dokumen.');

  const columns = [
    ['last_reviewed_at', 'datetime(3)'],
    ['last_reviewed_by', 'int unsigned'],
    ['last_reviewed_version', 'int'],
  ];
  for (const [name, type] of columns) {
    const found = await read(connection,
      'SELECT COLUMN_TYPE columnType,IS_NULLABLE nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
      ['v2_documents', name]);
    if (!found.length) {
      await connection.query(`ALTER TABLE v2_documents ADD COLUMN ${name} ${type.toUpperCase()} NULL`);
      continue;
    }
    // Strip MariaDB display-width parentheses for comparison, e.g. "int(10) unsigned" → "int unsigned"
    const actual = String(found[0].columnType).toLowerCase().replace(/\(\d+\)/g, '').replace(/\s+/g, ' ').trim();
    const expected = type.toLowerCase().replace(/\(\d+\)/g, '').replace(/\s+/g, ' ').trim();
    assert(actual === expected && found[0].nullable === 'YES',
      `Kolom ${name} sudah ada dengan definisi yang tidak sesuai (expected: ${expected}, actual: ${actual}).`);
  }

  const index = await read(connection,
    "SELECT COLUMN_NAME columnName,SEQ_IN_INDEX sequence FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='v2_documents' AND INDEX_NAME='idx_v2_documents_review' ORDER BY SEQ_IN_INDEX");
  if (!index.length) {
    await connection.query('ALTER TABLE v2_documents ADD KEY idx_v2_documents_review (status,last_reviewed_at,last_reviewed_version)');
  } else {
    assert(index.map(row => row.columnName).join(',') === 'status,last_reviewed_at,last_reviewed_version',
      'Index idx_v2_documents_review sudah ada dengan susunan kolom berbeda.');
  }

  const foreignKey = await read(connection,
    'SELECT k.COLUMN_NAME columnName,k.REFERENCED_TABLE_NAME referencedTable,k.REFERENCED_COLUMN_NAME referencedColumn,r.DELETE_RULE deleteRule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME=? AND k.CONSTRAINT_NAME=?',
    ['v2_documents', 'fk_v2_documents_review_user']);
  if (!foreignKey.length) {
    await connection.query('ALTER TABLE v2_documents ADD CONSTRAINT fk_v2_documents_review_user FOREIGN KEY (last_reviewed_by) REFERENCES users(id) ON DELETE SET NULL');
  } else {
    assert(foreignKey.length === 1 && foreignKey[0].columnName === 'last_reviewed_by' &&
      foreignKey[0].referencedTable === 'users' && foreignKey[0].referencedColumn === 'id' &&
      foreignKey[0].deleteRule === 'SET NULL', 'Foreign key reviewer sudah ada dengan definisi berbeda.');
  }

  return {columns: columns.map(([name]) => name), index: 'idx_v2_documents_review', foreignKey: 'fk_v2_documents_review_user'};
}
