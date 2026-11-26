# Revisi UI dan review tahunan — 26 November 2026

## Keputusan pengguna

- **Ringkasan** menjadi **Dashboard**.
- **Master Dokumen** membuka dashboard khusus dengan kategori Sertifikasi, Asesmen, dan Konsultasi Sistem Manajemen.
- **Daftar Dokumen** menelusuri dokumen menurut kategori dan pohon folder. Menu File Explorer terpisah dihapus; struktur folder dan layanan folder tetap digunakan di dalam daftar.
- **Review tahunan** menampilkan status per dokumen dan tombol **Sudah direview** untuk Editor/Super user yang berhak pada bidang dokumen. Dokumen yang belum pernah direview, versi aktifnya berubah, atau telah lewat satu tahun ditandai perlu direview. Penandaan menyimpan versi, waktu, pengguna, optimistic lock, dan audit.
- Peta Dokumen memakai tata letak pohon yang lebih terstruktur dan bagan menjadi tampilan awal.

Review adalah pencatatan berkala, bukan approval dan tidak menahan penerbitan atau pergantian versi. Kategori pada dashboard menelusuri folder akar dengan nama yang sama persis; file tetap menggunakan kategori/path folder yang telah disimpan.

## Perubahan source

Implementasi lokal berada di `edms-v2`. Migration aditif `011_document_review.sql` menambah kolom review pada `v2_documents`; API review berada pada `POST /api/v2/documents/:id/review`. Aplikasi tidak menjalankan migrasi schema pada startup.

Perubahan source belum diuji, dibangun sebagai paket rilis, dimigrasikan ke database mana pun, atau dideploy ke NAS. NAS tetap mengikuti bukti rilis terakhir di `docs/IMPLEMENTASI_V2.md`. Sebelum rilis, jalankan verifikasi dengan file DUMMY, backup DB+file baru, rehearsal/restore migrasi, dan gate runtime yang tercantum pada panduan produksi. Jangan mengimpor Dokumen Final sebagai test.
