-- ============================================================
-- Migration: Nomor dokumen SPB/SBBK (format MM + urut 3 digit)
-- Contoh: 09001 = penyerahan September ke-1; 10001 = penyerahan Oktober ke-1.
--
-- Aturan nomor:
--  - Nomor hanya terbentuk setelah barang DISERAHKAN (delivered_at terisi).
--    Permintaan yang masih draft/menunggu persetujuan tidak punya nomor.
--  - Urutan mengikuti tanggal serah (bukan tanggal permintaan).
--  - Prefix bulan diambil dari bulan tanggal serah; urutan reset tiap bulan.
--  - Nomor disimpan per grup permintaan agar tetap sama saat dicetak ulang.
--
-- Jalankan: mysql -h 127.0.0.1 -u root pemeliharaan_aset_bpom < data/migration_permintaan_nomor.sql
-- (idempotent — aman dijalankan ulang)
-- ============================================================

-- 1. Tambah kolom bila belum ada (mis. setelah kolom dihapus manual)
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

-- 2. Grup yang belum pernah diserahkan tidak boleh menyimpan nomor
UPDATE permintaan_barang p
LEFT JOIN (
  SELECT group_id
  FROM permintaan_barang
  WHERE delivered_at IS NOT NULL
  GROUP BY group_id
) d ON d.group_id = p.group_id
SET p.nomor_dokumen = NULL
WHERE d.group_id IS NULL
  AND p.nomor_dokumen IS NOT NULL;

-- 3. Isi nomor untuk grup yang sudah diserahkan, urut tanggal serah per bulan
UPDATE permintaan_barang p
JOIN (
  SELECT g.group_id, g.bln,
         LPAD(ROW_NUMBER() OVER (PARTITION BY g.bln ORDER BY g.tgl_serah, g.created_first), 3, '0') AS seq
  FROM (
    SELECT group_id,
           DATE_FORMAT(MIN(delivered_at), '%m') AS bln,
           MIN(delivered_at) AS tgl_serah,
           MIN(created_at) AS created_first
    FROM permintaan_barang
    WHERE delivered_at IS NOT NULL
    GROUP BY group_id
  ) g
) x ON x.group_id = p.group_id
SET p.nomor_dokumen = CONCAT(x.bln, x.seq);
