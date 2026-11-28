import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool,query} from '../src/lib/db.mjs';
import {manageFolders} from '../src/lib/folder-api.mjs';

const tag=process.env.DUMMY_TEST_RUN;
if(process.env.DB_HOST!=='127.0.0.1'||process.env.DB_NAME!=='edms_dummy'||!/^DUMMY-[a-f0-9]+$/.test(tag||''))throw Error('Requires an isolated local fixture database');
try{
 const {insertId}=await query("INSERT INTO users(username,full_name,password_hash,role_id) SELECT ?,?,'!',id FROM roles WHERE name='Super user'",[tag,tag]);
 const user={id:insertId,role:'Super user',fullName:tag};
 async function fixture(name){
  const folder=randomUUID(),doc=randomUUID();
  await query('INSERT INTO v2_folder_nodes(id,category,name,path_hash,department) VALUES(?,?,?,SHA2(?,256),?)',[folder,name,name,folder,'TEST']);
  await query('INSERT INTO v2_documents(id,code,title,department,kind,owner_id,test_tag) VALUES(?,?,?,?,?,?,?)',[doc,doc,tag,'TEST','TEST',insertId,tag]);
  await query('INSERT INTO v2_document_folders(document_id,folder_id) VALUES(?,?)',[doc,folder]);
  return doc;
 }
 async function search(scope){
  const url=new URL('http://localhost/api/v2/folders');
  url.searchParams.set('search',tag);
  if(scope)url.searchParams.set('category',scope);
  const data=await manageFolders({url:url.href,method:'GET'},['folders'],user,null,value=>value);
  return data.searchResults.map(doc=>doc.id).sort();
 }
 const legacy=await fixture('0. MM - '+tag);
 const assessment=await fixture('Asesmen');
 assert.deepEqual(await search('Sertifikasi'),[legacy]);
 const explicit=await fixture('Sertifikasi');
 assert.deepEqual(await search('Sertifikasi'),[explicit]);
 assert.deepEqual(await search('Asesmen'),[]);
 assert.deepEqual(await search(''),[assessment,legacy,explicit].sort());
 console.log('PASS scoped register search with legacy, explicit and unrelated roots');
}finally{await pool().end();}
