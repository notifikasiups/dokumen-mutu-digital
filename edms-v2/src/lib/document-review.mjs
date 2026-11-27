import {withTransaction,rows} from './db.mjs';
import {fail} from './core.mjs';
import {audit,requireEditor} from './security.mjs';
import {reviewColumns,utcString} from './review-schedule.mjs';

async function lockedDocument(c,documentId,data){
 const {expectedVersion,lockVersion}=data||{};
 if(!/^[a-f0-9-]{36}$/i.test(documentId||''))fail('ID dokumen tidak valid');
 if(!Number.isInteger(expectedVersion)||expectedVersion<1||!Number.isInteger(lockVersion)||lockVersion<0)fail('Versi dokumen tidak valid');
 const [doc]=await rows(c,`SELECT d.*, ${reviewColumns} FROM v2_documents d WHERE id=? FOR UPDATE`,[documentId]);
 if(!doc)fail('Dokumen tidak ditemukan',404);
 if(doc.status!=='Aktif')fail('Hanya dokumen aktif yang dapat direview',409);
 if(Number(doc.active_version)!==expectedVersion||Number(doc.lock_version)!==lockVersion)fail('Dokumen berubah. Muat ulang daftar untuk melihat versi terbaru.',409);
 return doc;
}

export async function markDocumentReviewed(documentId,data,user,req){
 return withTransaction(async c=>{
  const doc=await lockedDocument(c,documentId,data);
  requireEditor(user,{department:doc.department,status:doc.status});
  if(doc.review_status==='current')fail('Versi ini sudah direview dan belum jatuh tempo.',409);
  await rows(c,'UPDATE v2_documents SET review_due_override_utc=NULL,last_reviewed_at=NOW(3),last_reviewed_by=?,last_reviewed_version=active_version,lock_version=lock_version+1 WHERE id=?',[user.id,doc.id]);
  const [updated]=await rows(c,`SELECT ${reviewColumns} FROM v2_documents d WHERE id=?`,[doc.id]);
  const reviewedAt=utcString(updated.reviewed_utc),reviewDueAt=utcString(updated.review_due_at);
  await audit(c,user,req,'REVIEW_DOCUMENT',doc.id,{version:doc.active_version,reviewedAt,dueAt:reviewDueAt});
  return {documentId:doc.id,reviewedAt,reviewDueAt,reviewedVersion:Number(doc.active_version)};
 });
}

export async function resetDocumentReview(documentId,data,user,req){
 if(user.role!=='Super user')fail('Hanya Super user yang dapat membuka ulang review',403);
 return withTransaction(async c=>{
  const doc=await lockedDocument(c,documentId,data);
  if(!doc.last_reviewed_at)fail('Belum ada catatan review yang dapat dibuka ulang',409);
  const previous={reviewedAt:utcString(doc.reviewed_utc),reviewedBy:doc.last_reviewed_by,reviewedVersion:doc.last_reviewed_version,previousDueAt:utcString(doc.review_due_at)};
  await rows(c,'UPDATE v2_documents SET review_due_override_utc=NULL,last_reviewed_at=NULL,last_reviewed_by=NULL,last_reviewed_version=NULL,lock_version=lock_version+1 WHERE id=?',[doc.id]);
  await audit(c,user,req,'RESET_DOCUMENT_REVIEW',doc.id,previous);
  return {documentId:doc.id,reviewReset:true};
 });
}

export async function scheduleDocumentReview(documentId,data,user,req){
 if(user.role!=='Super user')fail('Jadwal review hanya dapat diatur oleh Super user.',403);
 const value=data?.dueAtWib;
 let override=null;
 if(value!==null){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||Number(value.slice(0,4))<1001)fail('Tanggal dan jam WIB tidak valid.');
  const wallClock=new Date(value+':00Z');
  if(!Number.isFinite(wallClock.getTime())||wallClock.toISOString().slice(0,16)!==value)fail('Tanggal dan jam WIB tidak valid.');
  override=new Date(value+':00+07:00').toISOString().slice(0,23).replace('T',' ');
 }
 return withTransaction(async c=>{
  const doc=await lockedDocument(c,documentId,data);
  if(!['current','overdue'].includes(doc.review_status))fail('Tandai versi aktif sudah direview sebelum mengatur jadwal.',409);
  await rows(c,'UPDATE v2_documents SET review_due_override_utc=?,lock_version=lock_version+1 WHERE id=?',[override,doc.id]);
  const [updated]=await rows(c,`SELECT ${reviewColumns} FROM v2_documents d WHERE id=?`,[doc.id]);
  const dueAt=utcString(updated.review_due_at);
  await audit(c,user,req,'SET_DOCUMENT_REVIEW_SCHEDULE',doc.id,{version:doc.active_version,previousDueAt:utcString(doc.review_due_at),dueAt,custom:override!==null});
  return {documentId:doc.id,reviewDueAt:dueAt};
 });
}
