-- ============================================================
-- Migration: Nomor dokumen SPB/SBBK per bulan (format MM + urut 3 digit)
-- Contoh: 09001 = September, nomor urut 1; 10001 = Oktober, nomor urut 1.
-- Nomor disimpan per grup permintaan agar tetap sama saat dicetak ulang.
-- Jalankan: mysql -h 127.0.0.1 -u root pemeliharaan_aset_bpom < data/migration_permintaan_nomor.sql
-- (idempotent — aman dijalankan ulang)
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'permintaan_barang'
    AND COLUMN_NAME = 'nomor_dokumen'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE permintaan_barang ADD COLUMN nomor_dokumen VARCHAR(10) DEFAULT NULL AFTER group_id',
  'SELECT ''permintaan_barang.nomor_dokumen sudah ada''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill data lama: urutkan per grup berdasarkan tanggal permintaan, dimulai dari 001
SET @numbered := (SELECT COUNT(*) FROM permintaan_barang WHERE nomor_dokumen IS NOT NULL);
SET @sql := IF(@numbered = 0,
  'UPDATE permintaan_barang p
   JOIN (
     SELECT g.group_id, g.bln,
            ROW_NUMBER() OVER (PARTITION BY g.bln ORDER BY g.tgl, g.created_first) AS seq
     FROM (
       SELECT group_id,
              DATE_FORMAT(COALESCE(MIN(tanggal_permintaan), MIN(created_at)), ''%m'') AS bln,
              COALESCE(MIN(tanggal_permintaan), MIN(created_at)) AS tgl,
              MIN(created_at) AS created_first
       FROM permintaan_barang
       GROUP BY group_id
     ) g
   ) x ON x.group_id = p.group_id
   SET p.nomor_dokumen = CONCAT(x.bln, LPAD(x.seq, 3, ''0''))',
  'SELECT ''nomor_dokumen sudah terisi''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
