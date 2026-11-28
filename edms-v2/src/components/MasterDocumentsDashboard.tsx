'use client';
import {categoryRoots} from '../lib/register-category.mjs';
import {IconBuilding,IconCheckCircle,IconDocuments,IconFolder,IconRefresh} from './Icons';
import {useResource} from './useResource';
import s from './MasterDocumentsDashboard.module.css';

type Folder={id:string;parentId:string|null;name:string};
type FolderCatalog={folders:Folder[]};
const categories=[
 {name:'Sertifikasi',description:'Buka kelompok kerja, dokumen mutu, dan lampiran untuk layanan sertifikasi.',Icon:IconCheckCircle},
 {name:'Asesmen',description:'Dokumen asesmen belum tersedia pada register saat ini.',Icon:IconBuilding,comingSoon:true},
 {name:'Konsultasi Sistem Manajemen',description:'Dokumen konsultasi belum tersedia pada register saat ini.',Icon:IconDocuments,comingSoon:true}
];

export function MasterDocumentsDashboard({onSelect}:{onSelect:(category:string)=>void}){
 const resource=useResource<FolderCatalog>('folders?catalog=1');
 const roots=categoryRoots(resource.data?.folders||[],'Sertifikasi');
 return <div className={s.dashboard}>
  <header className={s.header}><div><h1>Master Dokumen</h1><p>Pilih layanan untuk membuka register dokumen.</p></div><button type="button" className={s.refresh} onClick={resource.reload} disabled={resource.loading}><IconRefresh/>Muat ulang</button></header>
  {resource.error&&<p className={s.error} role="alert">{resource.error} <button type="button" onClick={resource.reload}>Coba lagi</button></p>}
  <section className={s.cards} aria-label="Kelompok Master Dokumen">
   {categories.map(({name,description,Icon,comingSoon})=>{
    const exists=!comingSoon&&!!(roots.explicit||roots.legacy.length);
    return <button type="button" key={name} className={s.card} disabled={comingSoon} onClick={()=>onSelect(name)}>
     {comingSoon&&<span className={s.watermark} aria-hidden="true">COMING SOON</span>}
     <span className={s.cardTop}><span className={s.cardIcon}><Icon size={22}/></span>{comingSoon&&<span className={s.comingSoon}>Segera hadir</span>}</span>
     <span className={s.cardTitle}>{name}</span><span className={s.cardDescription}>{description}</span>
     <span className={s.cardFooter}><span className={comingSoon?s.notAvailable:exists?s.available:s.notAvailable}><IconFolder size={15}/>{comingSoon?'Data belum tersedia':resource.error?'Gagal memuat kelompok':resource.loading?'Memeriksa folder…':exists?'Folder tersedia':'Folder tidak tersedia'}</span>{!comingSoon&&<span className={s.openLink}>Buka register <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span>}</span>
    </button>;
   })}
  </section>

 </div>;
}
