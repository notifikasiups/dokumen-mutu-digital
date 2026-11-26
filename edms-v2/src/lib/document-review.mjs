import {withTransaction,rows} from './db.mjs';
import {fail} from './core.mjs';
import {audit,requireEditor} from './security.mjs';

function validId(value){if(!/^[a-f0-9-]{36}$/i.test(value||''))fail('ID dokumen tidak valid');return value;}
export async function markDocumentReviewed(documentId,data,user,req){
 const expectedVersion=Number(data?.expectedVersion),lockVersion=Number(data?.lockVersion);
 if(!Number.isInteger(expectedVersion)||expectedVersion<1||!Number.isInteger(lockVersion)||lockVersion<0)fail('Versi dokumen tidak valid');
 return withTransaction(async c=>{
  const [doc]=await rows(c,'SELECT * FROM v2_documents WHERE id=? FOR UPDATE',[validId(documentId)]);
  if(!doc)fail('Dokumen tidak ditemukan',404);
  if(doc.status!=='Aktif')fail('Hanya dokumen aktif yang dapat direview',409);
  requireEditor(user,{department:doc.department,status:doc.status});
  if(Number(doc.active_version)!==expectedVersion||Number(doc.lock_version)!==lockVersion)fail('Dokumen berubah sejak daftar dimuat. Muat ulang sebelum mencatat review.',409);
  await rows(c,'UPDATE v2_documents SET last_reviewed_at=NOW(3),last_reviewed_by=?,last_reviewed_version=active_version,lock_version=lock_version+1 WHERE id=?',[user.id,doc.id]);
  const [updated]=await rows(c,'SELECT last_reviewed_at,last_reviewed_version,DATE_ADD(last_reviewed_at,INTERVAL 1 YEAR) review_due_at FROM v2_documents WHERE id=?',[doc.id]);
  await audit(c,user,req,'REVIEW_DOCUMENT',doc.id,{version:Number(updated.last_reviewed_version),reviewedAt:updated.last_reviewed_at,dueAt:updated.review_due_at});
  return {documentId:doc.id,reviewedAt:updated.last_reviewed_at,reviewDueAt:updated.review_due_at,reviewedVersion:Number(updated.last_reviewed_version)};
 });
}
