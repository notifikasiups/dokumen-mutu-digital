'use client';
import {useMemo} from 'react';
import {IconBuilding,IconCheckCircle,IconDocuments,IconFolder,IconRefresh} from './Icons';
import {useResource} from './useResource';
import s from './MasterDocumentsDashboard.module.css';

type Folder={id:string;parentId:string|null;name:string};
type FolderCatalog={folders:Folder[]};
const categories=[
 {name:'Sertifikasi',description:'Dokumen untuk proses dan layanan sertifikasi.',Icon:IconCheckCircle},
 {name:'Asesmen',description:'Dokumen untuk pelaksanaan dan pengendalian asesmen.',Icon:IconBuilding},
 {name:'Konsultasi Sistem Manajemen',description:'Dokumen untuk layanan konsultasi sistem manajemen.',Icon:IconDocuments}
];

export function MasterDocumentsDashboard({onSelect}:{onSelect:(category:string)=>void}){
 const resource=useResource<FolderCatalog>('folders?catalog=1');
 const roots=useMemo(()=>new Set((resource.data?.folders||[]).filter(folder=>!folder.parentId).map(folder=>folder.name.toLocaleLowerCase('id'))),[resource.data]);
 return <div className={s.dashboard}>
  <header className={s.header}><div><span className={s.eyebrow}>Pusat dokumen</span><h1>Master Dokumen</h1><p>Pilih kelompok dokumen untuk menelusuri kategori dan folder yang sudah terdaftar.</p></div><button type="button" className={s.refresh} onClick={resource.reload} disabled={resource.loading}><IconRefresh/>Muat ulang</button></header>
  {resource.error&&<p className={s.error} role="alert">{resource.error} <button type="button" onClick={resource.reload}>Coba lagi</button></p>}
  <section className={s.cards} aria-label="Kelompok Master Dokumen">
   {categories.map(({name,description,Icon})=>{
    const exists=roots.has(name.toLocaleLowerCase('id'));
    return <button type="button" key={name} className={s.card} onClick={()=>onSelect(name)}>
     <span className={s.cardIcon}><Icon size={22}/></span><span className={s.cardTitle}>{name}</span><span className={s.cardDescription}>{description}</span>
     <span className={s.cardFooter}><span className={exists?s.available:s.notAvailable}><IconFolder size={15}/>{resource.loading?'Memeriksa folder…':exists?'Folder tersedia':'Folder tidak tersedia'}</span><span className={s.openLink}>Buka kategori <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span></span>
    </button>;
   })}
  </section>
  {!resource.error&&<p className={s.note}>Isi setiap kelompok mengikuti folder dengan nama kategori yang sama pada Daftar Dokumen. File asli dan susunan subfolder tetap berada pada lokasi penyimpanannya.</p>}
 </div>;
}
