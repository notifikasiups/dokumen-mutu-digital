import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool,query} from '../src/lib/db.mjs';
import {document} from '../src/lib/documents.mjs';
import {markDocumentReviewed,scheduleDocumentReview} from '../src/lib/document-review.mjs';

if(process.env.DB_HOST!=='127.0.0.1'||process.env.DB_NAME!=='edms_dummy'||!/^DUMMY-[a-f0-9]+$/.test(process.env.DUMMY_TEST_RUN||''))throw Error('Requires an isolated local fixture database');
const id=randomUUID(),tag=process.env.DUMMY_TEST_RUN;
try{
 const {insertId}=await query("INSERT INTO users(username,full_name,password_hash,role_id) SELECT ?,?,'!',id FROM roles WHERE name='Super user'",[tag,tag]);
 const user={id:insertId,role:'Super user',fullName:tag};
 await query("INSERT INTO v2_documents(id,code,title,department,kind,owner_id,test_tag) VALUES(?,?,?,'TEST','TEST',?,?)",[id,tag,tag,insertId,tag]);
 const version=async()=>({expectedVersion:1,lockVersion:(await document(id)).lockVersion});
 await markDocumentReviewed(id,await version(),user);
 const annual=(await document(id)).reviewDueAt;
 assert.ok(Date.parse(annual)>Date.now()+360*86400000);
 const options={...await version(),dueAtWib:'2026-01-01T08:15'};
 await assert.rejects(scheduleDocumentReview(id,options,{...user,role:'Editor'}));
 await scheduleDocumentReview(id,options,user);
 await assert.rejects(scheduleDocumentReview(id,options,user));
 let record=await document(id);
 assert.equal(Date.parse(record.reviewDueAt),Date.parse('2026-01-01T01:15Z'));
 await scheduleDocumentReview(id,{...await version(),dueAtWib:null},user);
 assert.equal((await document(id)).reviewDueAt,annual);
 await scheduleDocumentReview(id,{...await version(),dueAtWib:'2020-01-01T08:15'},user);
 assert.equal((await document(id)).reviewStatus,'overdue');
 await markDocumentReviewed(id,await version(),user);
 record=await document(id);
 assert.equal(record.customSchedule,false);
 assert.equal(record.reviewStatus,'current');
 console.log('PASS review schedule, WIB, role, conflict, expiry and annual reset');
}finally{await pool().end();}
