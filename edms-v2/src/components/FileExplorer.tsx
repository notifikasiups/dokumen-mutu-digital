'use client';
import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ReviewSchedule,reviewDate} from './ReviewSchedule';
import {categoryRoots} from '../lib/register-category.mjs';
import s from './FileExplorer.module.css';
import w from '../app/workspace.module.css';
import {IconCheck,IconArrowLeft,IconPlus,IconRefresh,IconSearch} from './Icons';

type Folder={id:string;parentId:string|null;category:string;relativePath:string;name:string;department:string|null;updatedAt:string;canManage:boolean;path?:string};
type DocumentRow={id:string;code:string;title:string;department:string;kind:string;category:string;activeVersion:number;lockVersion:number;updatedAt:string;documentDate:string|null;dateStatus:string;formats:string;canEdit:boolean;canReview:boolean;lastReviewedAt:string|null;lastReviewedByName:string|null;reviewDueAt:string|null;reviewStatus:'unreviewed'|'version_changed'|'overdue'|'current';reviewDue:boolean;customSchedule:boolean;reviewClock:string;folderPath?:string};
type AttachmentGroup={folder:Folder|null;documents:DocumentRow[]};
type User={role:string;bidang?:string};
type Master={id:string;type:string;value:string;label:string;isActive:number};
async function request(path:string,options:RequestInit={}){
 const result=await fetch('/api/v2/'+path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await result.json();if(!result.ok)throw new Error(data.error||'Permintaan gagal');return data;
}
const json=(method:string,data:unknown)=>({method,body:JSON.stringify(data)});
const displayDate=(value:string|null|undefined)=>{if(!value)return '—';const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(value);if(!match)return '—';const calendarDate=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(calendarDate);};
const documentDateStatus=(value:string)=>value==='verified'?'Dikonfirmasi admin':value==='extracted'?'Terbaca dari file':value==='missing'?'Belum tercatat':'Perlu verifikasi';
function OptionsIcon(){
 return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
  <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
 </svg>;
}
function FolderIcon(){return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/></svg>}
function ReviewStatus({document:doc}:{document:DocumentRow}){
 const labels={unreviewed:'Belum pernah direview',version_changed:'Versi aktif belum direview',overdue:'Review jatuh tempo',current:'Sudah direview'};
 const showDeadline=doc.reviewStatus==='overdue'||doc.reviewStatus==='current';
 return <div className={s.reviewCell}>
  <span className={doc.reviewDue?s.reviewDue:s.reviewCurrent}>{labels[doc.reviewStatus]}</span>
  {showDeadline&&doc.reviewDueAt&&<small>{doc.reviewDue?'Tenggat':'Tinjau kembali'}<br/><time dateTime={doc.reviewDueAt}>{reviewDate(doc.reviewDueAt)}</time></small>}
  {doc.reviewDue&&!doc.canReview&&<small>Menunggu review Editor atau Super user.</small>}
 </div>;
}
export function FileExplorer({user,open,initialCategory,onAll,onUpload,canUpload}:{user:User;open:(id:string)=>void;initialCategory?:string;onAll:()=>void;onUpload?:()=>void;canUpload:boolean}){
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [current,setCurrent]=useState<string|null>(null),[view,setView]=useState<{folder:Folder|null;breadcrumb:Folder[];folders:Folder[];documents:DocumentRow[]}>({folder:null,breadcrumb:[],folders:[],documents:[]}),[attachmentGroups,setAttachmentGroups]=useState<AttachmentGroup[]>([]);
 const [catalog,setCatalog]=useState<Folder[]>([]),[trash,setTrash]=useState<Folder[]>([]),[masters,setMasters]=useState<Master[]>([]),[search,setSearch]=useState(''),[results,setResults]=useState<DocumentRow[]|null>(null),[sort,setSort]=useState('name'),[departmentFilter,setDepartmentFilter]=useState(''),[kindFilter,setKindFilter]=useState(''),[reviewFilter,setReviewFilter]=useState('all');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[reviewing,setReviewing]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[newName,setNewName]=useState(''),[department,setDepartment]=useState(user.bidang||''),[showCreate,setShowCreate]=useState(false),[missingCategory,setMissingCategory]=useState(''),[managed,setManaged]=useState<Folder|null>(null),[managedDocument,setManagedDocument]=useState<DocumentRow|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),documentDialog=useRef<HTMLDialogElement>(null);
 const previousFolder=useRef<string|null|undefined>(undefined);
 useEffect(()=>{if(managed)dialog.current?.showModal();else dialog.current?.close();},[managed]);
 useEffect(()=>{if(managedDocument)documentDialog.current?.showModal();else documentDialog.current?.close();},[managedDocument]);
 const canManage=user.role==='Super user'||user.role==='Editor'&&!!user.bidang?.trim();
 const generation=useRef(0);
 const load=useCallback(async(folderId=current,category?:string)=>{
  const run=++generation.current;
  setLoading(true);setError('');
  try{
   const [tree,masterData,deleted]=await Promise.all([request('folders?catalog=1'),request('masters'),request('folders?trash=1')]);
   if(run!==generation.current)return;
   const folders:Folder[]=tree.folders||[];
   const roots=initialCategory?categoryRoots(folders,initialCategory):null;
   let target=folderId;
   if(category){
    const remembered=folders.find(f=>f.id===history.state?.registerFolder);
    const allowed=roots?.explicit?[roots.explicit]:roots?.legacy;
    target=remembered&&(!allowed||allowed.some(root=>root.name===remembered.category))?remembered.id:roots?.explicit?.id||null;
    previousFolder.current=target;setCurrent(target);
   }
   setMissingCategory(roots&&!roots.explicit&&!roots.legacy.length?initialCategory||'':'');
   const data=await request('folders'+(target?'?folderId='+encodeURIComponent(target):''));
   const groups=data.folder&&data.folder.name.toLowerCase()!=='lampiran'
    ? (await request('folders?attachmentsUnder='+encodeURIComponent(data.folder.id))).groups||[]:[];
   if(run!==generation.current)return;
   setView(data);setAttachmentGroups(groups);setCatalog(folders);setMasters(masterData.values||[]);const scope=roots?.explicit?[roots.explicit]:roots?.legacy;
   setTrash((deleted.folders||[]).filter((folder:Folder)=>!scope||scope.some(root=>root.name===folder.category)));
   history.replaceState({...history.state,registerFolder:target},'');
  }catch(e:any){if(run===generation.current)setError(e.message);}
  finally{if(run===generation.current)setLoading(false);}
 },[current,initialCategory]);
 useEffect(()=>{
  if(previousFolder.current===current)return;
  const first=previousFolder.current===undefined;
  previousFolder.current=current;
  void load(current,first?initialCategory||'all':undefined);
 },[load,current,initialCategory]);
 useEffect(()=>()=>{generation.current++;previousFolder.current=undefined;},[]);
 const searchPath=(term:string)=>'folders?search='+encodeURIComponent(term)+(initialCategory?'&category='+encodeURIComponent(initialCategory):'');
 const [,redraw]=useState(0);
 const records=useMemo(()=>results??[...view.documents,...attachmentGroups.flatMap(g=>g.documents)], [results,view.documents,attachmentGroups]);
 const clock=useMemo(()=>{const server=Date.parse(records.find(d=>d.reviewClock)?.reviewClock||'');return Number.isFinite(server)?server-Date.now():0;},[records]);
 const now=Date.now()+clock;
 useEffect(()=>{
  const next=records.reduce((min,d)=>{const at=Date.parse(d.reviewDueAt||'');return d.reviewStatus==='current'&&at>now?Math.min(min,at):min;},Infinity);
  if(Number.isFinite(next)){const timer=setTimeout(()=>redraw(n=>n+1),Math.min(2147483647,Math.max(1,next-Date.now()-clock+1)));return ()=>clearTimeout(timer);}
 },[records,now,clock]);
 const moveTargets=useMemo(()=>catalog.filter(folder=>{let node:Folder|undefined=folder;const seen=new Set<string>();while(node){if(node.id===managed?.id||seen.has(node.id))return false;seen.add(node.id);node=catalog.find(item=>item.id===node?.parentId);}return true;}),[catalog,managed]);
 const attachmentFolderIds=new Set(attachmentGroups.flatMap(group=>group.folder?[group.folder.id]:[]));
 const categoryIndex=initialCategory?categoryRoots(catalog,initialCategory):null;
 const legacyIndex=!!categoryIndex&&!categoryIndex.explicit&&categoryIndex.legacy.length>0;
 const folders=[...(legacyIndex&&!current?categoryRoots(view.folders,initialCategory!).legacy:view.folders)].filter(folder=>!attachmentFolderIds.has(folder.id)).sort((a,b)=>Number(!/dokumen\s+wajib/i.test(a.name))-Number(!/dokumen\s+wajib/i.test(b.name))||(sort==='newest'?String(b.updatedAt).localeCompare(String(a.updatedAt)):a.name.localeCompare(b.name,'id',{numeric:true,sensitivity:'base'})));
 const sortDocuments=(items:DocumentRow[])=>[...items].sort((a,b)=>Number(!/dokumen\s+wajib/i.test(a.title))-Number(!/dokumen\s+wajib/i.test(b.title))||(sort==='newest'?String(b.updatedAt).localeCompare(String(a.updatedAt)):sort==='documentDate'?String(b.documentDate||'').localeCompare(String(a.documentDate||''))||a.title.localeCompare(b.title,'id',{numeric:true,sensitivity:'base'}):a.title.localeCompare(b.title,'id',{numeric:true,sensitivity:'base'})));
 const filterDocuments=(items:DocumentRow[])=>items.map((doc):DocumentRow=>doc.reviewStatus==='current'&&Date.parse(doc.reviewDueAt||'')<=now?{...doc,reviewStatus:'overdue',reviewDue:true}:doc).filter(doc=>(!departmentFilter||doc.department===departmentFilter)&&(!kindFilter||doc.kind===kindFilter)&&(reviewFilter==='all'||(reviewFilter==='due'?doc.reviewDue:!doc.reviewDue)));
 const isAttachmentLocation=view.folder?.name.toLocaleLowerCase('id')==='lampiran';
 const documentSource=results??[...view.documents,...attachmentGroups.flatMap(group=>group.documents)],allDocuments=sortDocuments(legacyIndex&&!current?[]:view.documents),directAttachments=allDocuments.filter(doc=>isAttachmentLocation||doc.kind.toLocaleLowerCase('id')==='lampiran'),documents=allDocuments.filter(doc=>!isAttachmentLocation&&doc.kind.toLocaleLowerCase('id')!=='lampiran'),visibleDocuments=filterDocuments(documents),visibleResults=filterDocuments(sortDocuments((results||[]).filter(doc=>!legacyIndex||categoryIndex!.legacy.some(folder=>folder.name===(doc.folderPath||doc.category).split('/')[0]))));
 const visibleAttachmentGroups:AttachmentGroup[]=[...attachmentGroups.map(group=>({...group,documents:filterDocuments(sortDocuments(group.documents))})),...(directAttachments.length?[{folder:null,documents:filterDocuments(directAttachments)}]:[])].filter(group=>group.documents.length>0);
 const attachmentDocumentCount=attachmentGroups.reduce((count,group)=>count+group.documents.length,0)+directAttachments.length;
 const visibleAttachmentCount=visibleAttachmentGroups.reduce((count,group)=>count+group.documents.length,0);
 const departmentOptions=Array.from(new Set(documentSource.map(doc=>doc.department).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'id',{sensitivity:'base'}));
 const kindOptions=Array.from(new Set(documentSource.map(doc=>doc.kind).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'id',{sensitivity:'base'}));
 const clearFilters=()=>{setDepartmentFilter('');setKindFilter('');setReviewFilter('all');};
 async function act(path:string,method:string,data:unknown){setBusy(true);setError('');setNotice('');try{await request(path,json(method,data));setNotice('Perubahan folder tersimpan.');setSearch('');setResults(null);await load();return true;}catch(e:any){setError(e.message);return false;}finally{setBusy(false);}}
 async function createFolder(e:FormEvent<HTMLFormElement>){e.preventDefault();const name=newName.trim();if(!name)return;if(await act('folders','POST',{name,parentId:current,department:current?undefined:department})){setNewName('');setShowCreate(false);}}
 async function searchDocuments(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError('');try{if(!search.trim()){setResults(null);return;}const data=await request(searchPath(search.trim()));setResults(data.searchResults||[]);}catch(e:any){setError(e.message);}finally{setLoading(false);}}
 async function updateFolder(folder:Folder,action:string,extra:Record<string,unknown>={}){if(await act('folders?folderId='+encodeURIComponent(folder.id),'PATCH',{action,...extra}))setManaged(null);}
 async function moveDocument(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!managedDocument)return;const folderId=String(new FormData(e.currentTarget).get('folderId')||'')||null;if(await act('document-location','PATCH',{documentId:managedDocument.id,folderId,lockVersion:managedDocument.lockVersion,expectedVersion:managedDocument.activeVersion}))setManagedDocument(null);}
 async function markReviewed(doc:DocumentRow){setReviewing(doc.id);setError('');setNotice('');try{await request('documents/'+doc.id+'/review',json('POST',{expectedVersion:doc.activeVersion,lockVersion:doc.lockVersion}));setNotice('Review dokumen dicatat. Pengingat berikutnya muncul satu tahun lagi atau setelah versi aktif berubah.');if(results!==null){const refreshed=await request(searchPath(search.trim()));setResults(refreshed.searchResults||[]);}else await load();}catch(e:any){setError(e.message);}finally{setReviewing(null);}}
 async function saveSchedule(value:string|null){
  if(!managedDocument)return;
  setBusy(true);setError('');
  try{
   await request('documents/'+managedDocument.id+'/review-schedule',json('PATCH',{dueAtWib:value,expectedVersion:managedDocument.activeVersion,lockVersion:managedDocument.lockVersion}));
   setManagedDocument(null);setNotice(value?'Jadwal review khusus tersimpan.':'Jadwal tahunan dipulihkan.');
   if(results!==null){const refreshed=await request(searchPath(search.trim()));setResults(refreshed.searchResults||[]);}else await load();
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 async function resetReview(doc:DocumentRow){if(!window.confirm('Buka ulang review untuk “'+doc.title+'”? Tombol “Tandai direview” akan tersedia kembali dan perubahan ini tercatat di histori aktivitas.'))return;setReviewing(doc.id);setError('');setNotice('');try{await request('documents/'+doc.id+'/review-reset',json('POST',{expectedVersion:doc.activeVersion,lockVersion:doc.lockVersion}));setManagedDocument(null);setNotice('Review dibuka ulang. Dokumen kembali menampilkan status perlu direview.');if(results!==null){const refreshed=await request(searchPath(search.trim()));setResults(refreshed.searchResults||[]);}else await load();}catch(e:any){setError(e.message);}finally{setReviewing(null);}}
 async function changeDocumentStatus(action:'archive'|'trash'){if(!managedDocument)return;const reason=window.prompt(action==='trash'?'Alasan memindahkan dokumen ke Sampah:':'Alasan mengarsipkan dokumen:');if(!reason?.trim())return;setBusy(true);setError('');try{const result=await request('document-actions',json('POST',{action,reason,documents:[{id:managedDocument.id,lockVersion:managedDocument.lockVersion,expectedVersion:managedDocument.activeVersion}]}));if(!result.results?.[0]?.ok)throw new Error(result.results?.[0]?.error||'Perubahan gagal');setManagedDocument(null);setNotice('Status dokumen diperbarui.');await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function saveApprovalDate(value:string|null){if(!managedDocument)return;setBusy(true);setError('');setNotice('');try{const result=await request('document-actions',json('POST',{action:'metadata',documentDate:value,documents:[{id:managedDocument.id,lockVersion:managedDocument.lockVersion,expectedVersion:managedDocument.activeVersion}]}));if(!result.results?.[0]?.ok)throw new Error(result.results?.[0]?.error||'Tanggal pengesahan gagal disimpan');setManagedDocument(null);setNotice('Tanggal pengesahan diperbarui dan dicatat pada histori aktivitas.');if(results!==null){const refreshed=await request(searchPath(search.trim()));setResults(refreshed.searchResults||[]);}else await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function saveApprovalDateForm(e:FormEvent<HTMLFormElement>){e.preventDefault();const value=String(new FormData(e.currentTarget).get('documentDate')||'');if(value)await saveApprovalDate(value);}
 const renderDocumentTable=(items:DocumentRow[],searchMode=false)=>items.length?<div className={s.tableWrap}>
  <table className={s.documentsTable}><thead><tr>
   {['Dokumen','Tanggal pengesahan','Versi','Status review','Terakhir diubah','Tindakan'].map(label=><th key={label} scope="col">{label}</th>)}
  </tr></thead><tbody>{items.map(doc=><tr key={doc.id}>
   <td className={s.documentCell}><button className={s.link} onClick={()=>open(doc.id)}>{doc.title}</button>
    <small>Nomor mutu · {doc.code}</small>{searchMode&&<small className={s.documentPath}>{doc.folderPath||doc.category||'Tingkat utama'}</small>}
   </td>
   <td data-label="Pengesahan" className={s.dateCell}>{displayDate(doc.documentDate)}<small>{documentDateStatus(doc.dateStatus)}</small></td>
   <td data-label="Versi" className={s.versionCell}>v{doc.activeVersion}</td>
   <td className={s.statusColumn}><ReviewStatus document={doc}/></td>
   <td data-label="Terakhir diubah" className={s.dateCell}>{displayDate(doc.updatedAt)}</td>
   <td><div className={s.rowTools}>
    {doc.reviewDue&&doc.canReview&&<button type="button" className={s.markReview} disabled={reviewing===doc.id}
     aria-label={'Tandai direview: '+doc.title} onClick={()=>markReviewed(doc)}><IconCheck size={15}/>{reviewing===doc.id?'Menyimpan…':'Tandai direview'}</button>}
    <button type="button" className={w.secondary} aria-label={'Opsi dokumen '+doc.title} title="Opsi dokumen" onClick={()=>setManagedDocument(doc)}><OptionsIcon/></button>
   </div></td>
  </tr>)}</tbody></table>
 </div>:null;
 return <>
  <div className={w.pageHead}><div><h1>{initialCategory==='Sertifikasi'?'Register Sertifikasi':'Register Dokumen'}</h1></div><div className={s.headActions}>{canUpload&&onUpload&&<button className={w.primary} onClick={onUpload}><IconPlus/>Upload dokumen</button>}{canManage&&(!initialCategory||!!current)&&<button className={w.secondary} onClick={()=>setShowCreate(value=>!value)} aria-expanded={showCreate}><IconPlus/>Folder baru</button>}<button className={w.secondary} onClick={()=>load()} disabled={loading||busy}><IconRefresh/>Muat ulang</button></div></div>
  {error&&<p role="alert" className={w.error}>{error}</p>}{notice&&<p role="status" className={w.notice}>{notice}</p>}
  <section className={w.panel}>
   <div className={s.toolbar}><form className={s.search} onSubmit={searchDocuments}><IconSearch/><input aria-label="Cari file dan folder" placeholder="Judul atau nomor mutu" value={search} onChange={e=>setSearch(e.target.value)}/><button type="submit" className={w.secondary}>Cari</button></form><button type="button" className={w.secondary} aria-controls="register-filters" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}>Filter &amp; urutan</button><div className={s.filterFields} id="register-filters" hidden={!filtersOpen}><label className={s.filter}><span>Bidang</span><select aria-label="Filter bidang" value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)}><option value="">Semua bidang</option>{departmentOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label className={s.filter}><span>Jenis</span><select aria-label="Filter jenis dokumen" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="">Semua jenis</option>{kindOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label className={s.filter}><span>Status review</span><select aria-label="Filter status review" value={reviewFilter} onChange={e=>setReviewFilter(e.target.value)}><option value="all">Semua status</option><option value="due">Perlu direview</option><option value="current">Sudah direview</option></select></label><label className={s.sort}><span>Urutkan</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Judul A–Z</option><option value="documentDate">Tanggal pengesahan terbaru</option><option value="newest">Terakhir diubah</option></select></label></div></div>
   {(departmentFilter||kindFilter||reviewFilter!=='all')&&<div className={s.filterSummary}><span>{results!==null?visibleResults.length:visibleDocuments.length+visibleAttachmentCount} dokumen sesuai filter</span><button type="button" className={w.textButton} onClick={clearFilters}>Hapus filter</button></div>}
    {missingCategory?<div className={w.empty}><FolderIcon/><h3>Folder kategori belum tersedia</h3><p>Belum ada folder akar bernama “{missingCategory}”. Pilih kategori lain atau telusuri semua folder.</p><button type="button" className={w.secondary} onClick={onAll}>Lihat semua folder</button></div>:results!==null?<><div className={s.sectionHead}><div><h2>Hasil pencarian</h2><p>{visibleResults.length} dari {results.length} dokumen ditemukan</p></div><button className={w.textButton} onClick={()=>{setResults(null);setSearch('');}}>Kembali ke folder</button></div>{visibleResults.length?renderDocumentTable(visibleResults,true):<div className={w.empty}><h3>Tidak ada hasil yang sesuai</h3><p>Ubah kata pencarian atau hapus filter untuk melihat dokumen lain.</p><button type="button" className={w.secondary} onClick={clearFilters}>Hapus filter</button></div>}</>
   :<>
     <div className={s.locationBar}>{current&&<button className={w.secondary} disabled={!current||loading||busy} onClick={()=>{setSearch('');if(categoryIndex?.explicit?.id===current)onAll();else setCurrent(view.folder?.parentId||null);}}><IconArrowLeft/>Kembali</button>}<nav className={s.breadcrumb} aria-label="Lokasi dokumen"><button onClick={()=>{if(initialCategory)onAll();else{setCurrent(null);setResults(null);}}} aria-current={!current?'page':undefined}>Semua kelompok</button>{view.breadcrumb.map((part,index)=><span key={part.id}><span aria-hidden="true">/</span><button onClick={()=>setCurrent(part.id)} aria-current={index===view.breadcrumb.length-1?'page':undefined}>{part.name.toLocaleLowerCase('id')==='lampiran'?'Lampiran':part.name}</button></span>)}</nav></div>
    {canManage&&showCreate&&<form className={s.create} onSubmit={createFolder}><label>Folder baru<input value={newName} onChange={e=>setNewName(e.target.value)} maxLength={500} placeholder={current?'Nama subfolder':'Nama kategori akar'} required/></label>{!current&&user.role==='Super user'&&<label>Bidang kategori<select value={department} onChange={e=>setDepartment(e.target.value)} required><option value="">Pilih bidang</option>{masters.filter(m=>m.type==='department'&&m.isActive).map(m=><option key={m.id} value={m.value}>{m.label}</option>)}</select></label>}<button className={w.primary} disabled={busy||!newName.trim()}><IconPlus/>Buat folder</button></form>}
    {loading?<p role="status" className={w.empty}>Memuat isi folder…</p>:<div className={folders.length&&(visibleDocuments.length||visibleAttachmentCount)?s.registerSplit:undefined}>
      {folders.length>0&&<section className={s.folderIndex} aria-labelledby="folder-index-heading"><div className={s.folderIndexHead}><div><h2 id="folder-index-heading">{current?'Subfolder pada bagian ini':'Kelompok dokumen'} ({folders.length})</h2></div></div><ol className={s.folderList}>{folders.map(folder=><li key={folder.id} className={s.folderItem}><button className={s.groupLink} onClick={()=>setCurrent(folder.id)} aria-label={folder.name}><strong>{folder.name}</strong><span className={s.folderMeta}><span>{folder.department||view.folder?.department||'Bidang belum ditentukan'}</span><span>Diubah {displayDate(folder.updatedAt)}</span></span><span className={s.groupArrow} aria-hidden="true">›</span></button><div className={s.folderActions}>{folder.canManage&&<button className={s.manageButton} aria-label={"Kelola folder "+folder.name} title="Opsi kelompok" onClick={()=>setManaged(folder)}><OptionsIcon/></button>}</div></li>)}</ol></section>}
      <div className={s.registerBody}>{visibleDocuments.length>0&&<><div className={s.registerHead}><div><h2>{current&&view.folder?'Dokumen · '+view.folder.name:'Dokumen'} ({visibleDocuments.length})</h2></div></div>{renderDocumentTable(visibleDocuments)}</>}
      {visibleAttachmentGroups.map((group,index)=><section key={group.folder?.id||'lampiran-inline-'+index} className={s.attachmentGroup} aria-labelledby={'attachment-heading-'+index}><div className={s.registerHead}><div><h2 id={'attachment-heading-'+index}>Lampiran ({group.documents.length})</h2><p>{group.folder?.relativePath}</p></div>{group.folder?.canManage&&<button className={s.manageButton} aria-label={'Kelola kelompok Lampiran '+(group.folder.path||'')} onClick={()=>setManaged(group.folder)}>Kelola Lampiran</button>}</div>{renderDocumentTable(group.documents)}</section>)}
      {((documents.length>0&&!visibleDocuments.length)||attachmentDocumentCount>visibleAttachmentCount)&&<div className={w.empty}><h3>Tidak ada dokumen yang sesuai</h3><p>Coba ubah bidang, jenis, atau status review yang dipilih.</p><button type="button" className={w.secondary} onClick={clearFilters}>Hapus filter</button></div>}
      {!folders.length&&!documents.length&&!attachmentDocumentCount&&<div className={w.empty}><FolderIcon/><h3>Bagian ini masih kosong</h3><p>Belum ada kelompok atau dokumen pada lokasi ini.</p></div>}
    </div></div>}
    {canManage&&trash.length>0&&<details className={s.trash}><summary>Folder terhapus ({trash.length})</summary>{trash.length?<ul>{trash.map(folder=><li key={folder.id}><span>{folder.path||folder.name}</span><button className={w.secondary} disabled={busy} onClick={()=>void updateFolder(folder,'restore')}>Pulihkan</button></li>)}</ul>:<p className={w.muted}>Tidak ada folder terhapus.</p>}</details>}
   </>}
  </section>
  <dialog ref={dialog} className={s.dialog} aria-labelledby="folder-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else setManaged(null);}} onClose={()=>setManaged(null)}>
   {managed&&<div key={managed.id}>
    <div className={s.dialogHead}><div><h2 id="folder-dialog-title">Kelola folder</h2><p>{managed.path||managed.name}</p></div><button className={w.secondary} disabled={busy} onClick={()=>setManaged(null)}>Tutup</button></div>
    {error&&<p role="alert" className={w.error}>{error}</p>}
    <form className={s.dialogForm} onSubmit={e=>{e.preventDefault();void updateFolder(managed,'rename',{name:String(new FormData(e.currentTarget).get('name')||'')});}}><label>Nama folder<input name="name" defaultValue={managed.name} maxLength={500} required autoFocus/></label><button className={w.primary} disabled={busy}>Simpan nama</button></form>
    <form className={s.dialogForm} onSubmit={e=>{e.preventDefault();void updateFolder(managed,'move',{parentId:String(new FormData(e.currentTarget).get('parentId')||'')||null});}}><label>Pindahkan ke<select name="parentId" defaultValue={managed.parentId||''}><option value="">Tingkat utama / kategori baru</option>{moveTargets.map(target=><option key={target.id} value={target.id}>{target.path||target.name}</option>)}</select></label><button className={w.secondary} disabled={busy}>Pindahkan folder</button></form>
    <div className={s.deleteArea}><p>Hanya folder kosong yang dapat dihapus.</p><button className={w.danger} disabled={busy} onClick={()=>{if(window.confirm('Hapus folder kosong ini? Dokumen tidak ikut dihapus.'))void updateFolder(managed,'delete');}}>Hapus folder kosong</button></div>
   </div>}
  </dialog>
  <dialog ref={documentDialog} className={s.dialog} aria-labelledby="document-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else setManagedDocument(null);}} onClose={()=>setManagedDocument(null)}>
   {managedDocument&&<div key={managedDocument.id}><div className={s.dialogHead}><div><h2 id="document-dialog-title">Kelola file dokumen</h2><p>{managedDocument.code} · {managedDocument.title}</p></div><button className={w.secondary} disabled={busy} onClick={()=>setManagedDocument(null)}>Tutup</button></div>{error&&<p role="alert" className={w.error}>{error}</p>}
    {managedDocument.lastReviewedAt&&<p className={w.muted}>Review terakhir · {reviewDate(managedDocument.lastReviewedAt)} · {managedDocument.lastReviewedByName||'—'}</p>}
    <div className={w.actions}><button className={w.secondary} onClick={()=>{setManagedDocument(null);open(managedDocument.id);}}>Buka detail dokumen</button></div>
    {user.role==='Super user'&&managedDocument.reviewDueAt&&['current','overdue'].includes(managedDocument.reviewStatus)&&<ReviewSchedule dueAt={managedDocument.reviewDueAt} custom={managedDocument.customSchedule} clockOffset={clock} busy={busy} onSave={saveSchedule}/>}
    {user.role==='Super user'&&managedDocument.reviewStatus==='current'&&<button type="button" className={s.reviewReset} disabled={busy||!!reviewing} onClick={()=>resetReview(managedDocument)}>Buka ulang review</button>}
    {managedDocument.canEdit&&user.role==='Super user'&&<form className={s.dialogForm} onSubmit={saveApprovalDateForm}><label>Tanggal pengesahan<input type="date" name="documentDate" defaultValue={managedDocument.documentDate?.slice(0,10)||''} required/><small>Status tanggal saat ini: {documentDateStatus(managedDocument.dateStatus)}.</small></label><div className={s.dateFormActions}><button className={w.primary} disabled={busy}>{busy?'Menyimpan…':'Simpan tanggal'}</button>{managedDocument.documentDate&&<button type="button" className={w.textButton} disabled={busy} onClick={()=>{if(window.confirm('Hapus tanggal pengesahan yang tercatat untuk dokumen ini?'))void saveApprovalDate(null);}}>Hapus tanggal</button>}</div><small>Perubahan tanggal dicatat di histori aktivitas dan menggunakan pemeriksaan versi dokumen.</small></form>}
    {managedDocument.canEdit&&<details className={s.extraActions}><summary>Pindah, arsip, atau hapus</summary><form className={s.dialogForm} onSubmit={moveDocument}><label>Pindahkan ke folder<select name="folderId" defaultValue={current||''}><option value="">Tingkat utama</option>{catalog.filter(folder=>folder.canManage&&folder.department===managedDocument.department).map(folder=><option key={folder.id} value={folder.id}>{folder.path||folder.name}</option>)}</select></label><button className={w.primary} disabled={busy}>Pindahkan dokumen</button></form><div className={s.deleteArea}><button className={w.secondary} disabled={busy} onClick={()=>void changeDocumentStatus('archive')}>Arsipkan</button><button className={w.danger} disabled={busy} onClick={()=>void changeDocumentStatus('trash')}>Pindahkan ke Sampah</button></div></details>}
   </div>}
  </dialog>
 </>;
}
