-- ============================================================
-- Migration: Kolom fungsi pada permintaan barang (ATK)
-- Menyimpan unit/fungsi pemohon untuk setiap grup permintaan:
--   Tata Usaha, Penindakan, Pemeriksaan, Infokom,
--   Lab Pangan, Lab Mikro, Lab Terano
-- Nilai ini tampil sebagai "Unit Seksi/Sub Bagian" pada cetak SPB & SBBK.
-- Jalankan: mysql -h 127.0.0.1 -u root pemeliharaan_aset_bpom < data/migration_permintaan_fungsi.sql
-- (idempotent — aman dijalankan ulang)
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'permintaan_barang'
    AND COLUMN_NAME = 'fungsi'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE permintaan_barang ADD COLUMN fungsi VARCHAR(50) DEFAULT ''Tata Usaha'' AFTER group_id',
  'SELECT ''permintaan_barang.fungsi sudah ada''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Data lama dianggap milik Tata Usaha (sesuai dokumen sebelumnya)
UPDATE permintaan_barang SET fungsi = 'Tata Usaha' WHERE fungsi IS NULL OR fungsi = '';
