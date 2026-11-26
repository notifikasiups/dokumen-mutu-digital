# Update NAS 2.1.11 — 26 November 2026

## Ringkasan

Update tampilan dan fitur tinjau dokumen berhasil diterapkan ke service aplikasi NAS yang sama. Image produksi `edms-ups:2.1.11` adalah `linux/amd64`, image ID `sha256:086e1efbbb2d725b0f5fb0d0d8745323bfbf68a761db1eb5ee0893330943b5bb`.

Perubahan yang tersedia:

- Ringkasan menjadi Dashboard; Master Dokumen memiliki dashboard dan menu kategori Sertifikasi, Asesmen, serta Konsultasi System Manajemen.
- Daftar dokumen tersusun per kategori/folder; File Explorer terpisah dihapus.
- Peta dokumen dirapikan untuk desktop dan mobile.
- Daftar dokumen memiliki tindakan “Sudah direview” dengan pengingat dan siklus tinjau tahunan.

## Backup dan restore rehearsal

- Backup maintenance NAS: `/share/Container/edms-backups/edms-update-20261126T071813Z-20520`.
- Receipt menyatakan `backupComplete=true`, `restoreVerified=false` pada backup asli, dan tidak ada penanda `INCOMPLETE`. Seluruh 12 hash artefak cocok; manifest file aplikasi berisi 36.517 entri.
- Salinan lokal berada di folder `%TEMP%` laptop, di luar OneDrive. Restore terisolasi `DUMMY-RESTORE-cde835b22ca5` lulus: 26 tabel/objek DB, seluruh hash file aplikasi, dan Compose cocok. `productionTouched=false`.
- Rehearsal migrasi 011 pada DB hasil restore menegaskan idempotensi, hitungan tetap 367 dokumen, 368 versi, 373 file, 1.227 audit, 8 akun, dan image lama 2.1.10 masih dapat membaca database setelah migrasi.
- Salinan backup lokal dan tool rehearsal dihapus setelah deployment terverifikasi. Backup sumber tetap disimpan di NAS.

## Rilis dan deployment

- Verifikasi image laptop `DUMMY-f2362811226f`: 56/56 tes inti, integrasi MariaDB/file/ZIP/konversi, UI dan responsive layout lulus. Seluruh fixture adalah sintetis dan berjalan hanya di laptop.
- Paket di `/share/Container/edms-release/app-update-2.1.11`; SHA-256 image tar `23fbcda9a7a0b8fb2d91da1306789bc7e9fed95bc41315b5217df0b5c67d43b4`.
- Restore gate `DUMMY-RESTORE-cde835b22ca5` terikat ke manifest backup dan paket yang sama.
- Update selesai pada `/share/CACHEDEV1_DATA/Container/edms-release/app-update-2.1.11/attempt-20261126T081347Z-6323`; receipt `NAS_APP_UPDATE_PASS` menyatakan migrasi `011-additive`, `productionDummySmoke=false`, dan `backupRestoreVerified=true`.
- Health setelah update: `{"ok":true,"version":"2.1.11","database":true}`. Container running/healthy, `OOMKilled=false`; preflight `productionReady=true`, storage/secret/Python/LibreOffice tersedia, 8 akun aktif.
- Tidak ada dummy smoke, upload dokumen, seed dokumen, purge, atau penghapusan data pada NAS. Migrasi menambah kolom nullable tinjau dan satu catatan versi migrasi; dokumen dan file asli tidak ditulis ulang.

## Git

Source dan perbaikan assertion migrasi sudah berada di branch `fitur/dev-lokal` sebagai commit `6b4d45b` dan `7c2a4e4`, dengan identitas `Yongky1 <kiki.yongky11@gmail.com>`. Tidak ada merge ke `main`.

Untuk update berikutnya, buat backup baru dan ulangi restore gate; jangan gunakan ulang snapshot ini setelah NAS menerima penulisan baru.
