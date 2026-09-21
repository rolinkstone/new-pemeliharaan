-- =====================================================================
-- MIGRASI PERFORMA: INDEX UNTUK QUERY YANG MASIH FULL TABLE SCAN
-- (2026-09-21)
--
-- Dasar: hasil EXPLAIN FORMAT=TREE pada query nyata aplikasi (performance_schema)
-- dan rencana eksekusinya sebelum ada index:
--   notifications      -> Table scan + Sort                  (query terpanas: 95x)
--   master_aset        -> Table scan + Sort (ORDER BY kode,nup)
--   aset_ruangan       -> Table scan + Filter status (4x per request)
--   aset_ruangan       -> Table scan + Sort tgl_masuk
--   barang_persediaan  -> Table scan + Sort / Temporary table
--   ruangan            -> Table scan + Sort (dipanggil 25x per sesi)
--
-- Aman dijalankan pada data berjalan: MySQL 8 menambahkan secondary index
-- secara ONLINE (ALGORITHM=INPLACE, LOCK=NONE) jika didukung engine.
-- Jalankan SEKALI. Kalau index sudah ada, statement akan gagal dengan
-- "Duplicate key name" - itu berarti sudah diterapkan, lanjutkan saja.
-- =====================================================================

USE pemeliharaan_aset_bpom;

-- ---------------------------------------------------------------------
-- 1. notifications
--    Query: SELECT * FROM notifications
--           WHERE (user_id = ? OR user_role IN (...))
--           ORDER BY created_at DESC LIMIT 50
--    Dibuat per-cabang karena WHERE ... OR tidak bisa memakai index tunggal.
-- ---------------------------------------------------------------------
CREATE INDEX idx_notif_user_created ON notifications (user_id, created_at);
CREATE INDEX idx_notif_role_created ON notifications (user_role, created_at);

-- ---------------------------------------------------------------------
-- 2. master_aset
--    a) ORDER BY kode_barang ASC, nup ASC LIMIT 2000  (dulu: table scan + sort)
--       juga mempercepat cek duplikat import: SELECT kode_barang, nup FROM master_aset
--    b) WHERE status_bmn = ? ORDER BY id DESC          (dulu: tidak ada index)
-- ---------------------------------------------------------------------
CREATE INDEX idx_ma_kode_nup ON master_aset (kode_barang, nup);
CREATE INDEX idx_ma_status_bmn ON master_aset (status_bmn);

-- ---------------------------------------------------------------------
-- 3. aset_ruangan
--    a) WHERE status = ? ORDER BY tgl_masuk DESC (list terfilter + COUNT per status)
--    b) ORDER BY tgl_masuk DESC LIMIT n           (list tanpa filter)
-- ---------------------------------------------------------------------
CREATE INDEX idx_ar_status_tgl ON aset_ruangan (status, tgl_masuk);
CREATE INDEX idx_ar_tgl_masuk ON aset_ruangan (tgl_masuk);

-- ---------------------------------------------------------------------
-- 4. barang_persediaan (dulu hanya PRIMARY KEY)
--    a) ORDER BY nama_barang ASC LIMIT n
--    b) SELECT DISTINCT jenis ... ORDER BY jenis
--    c) SELECT DISTINCT kategori ... ORDER BY kategori
-- ---------------------------------------------------------------------
CREATE INDEX idx_bp_nama ON barang_persediaan (nama_barang);
CREATE INDEX idx_bp_jenis ON barang_persediaan (jenis);
CREATE INDEX idx_bp_kategori ON barang_persediaan (kategori);

-- ---------------------------------------------------------------------
-- 5. ruangan
--    WHERE is_active = 1 ORDER BY kode_ruangan  (dropdown, dipanggil berulang)
-- ---------------------------------------------------------------------
CREATE INDEX idx_ruangan_active_kode ON ruangan (is_active, kode_ruangan);

-- ---------------------------------------------------------------------
-- 6. laporan_rusak (belum berat di data kecil, tapi pola aksesnya jelas:
--    filter status/ruangan/pelapor + ORDER BY tgl_laporan DESC, id DESC)
-- ---------------------------------------------------------------------
CREATE INDEX idx_lr_pelapor_tgl ON laporan_rusak (pelapor_id, tgl_laporan);
CREATE INDEX idx_lr_tgl ON laporan_rusak (tgl_laporan, id);
CREATE INDEX idx_lr_status_tgl ON laporan_rusak (status, tgl_laporan);
CREATE INDEX idx_lr_katim ON laporan_rusak (katim_id);
CREATE INDEX idx_lr_ppk ON laporan_rusak (ppk_id);

-- Catatan: setelah idx_ma_kode_nup dibuat, index lama `idx_kode_barang (kode_barang)`
-- menjadi redundan (hanya prefix). Boleh dihapus kapan saja:
--   DROP INDEX idx_kode_barang ON master_aset;
