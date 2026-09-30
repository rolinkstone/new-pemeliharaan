-- ============================================================
-- Tambah KODE BARANG pada master persediaan (ATK).
--
-- Aturan (permintaan user):
--   * kode_barang WAJIB diisi
--   * unik PER JENIS — contoh: jenis "ALAT TULIS" 0001..NNNN,
--     jenis lain (mis. "BUKU TULIS") mulai dari 0001 lagi
-- ============================================================

-- 1) Kolom baru (nullable dulu supaya data lama bisa diisi)
ALTER TABLE barang_persediaan
  ADD COLUMN kode_barang VARCHAR(20) NULL AFTER id;

-- 2) Backfill data lama: penomoran 0001.. per jenis, urut nama barang
--    (id sebagai penentu urutan bila nama sama)
UPDATE barang_persediaan bp
JOIN (
  SELECT id,
         LPAD(ROW_NUMBER() OVER (PARTITION BY jenis ORDER BY nama_barang ASC, id ASC), 4, '0') AS kode
  FROM barang_persediaan
) t ON t.id = bp.id
SET bp.kode_barang = t.kode
WHERE bp.kode_barang IS NULL OR bp.kode_barang = '';

-- 3) Kode barang wajib; jenis wajib (kunci penomoran per jenis)
ALTER TABLE barang_persediaan
  MODIFY COLUMN jenis VARCHAR(100) NOT NULL DEFAULT '',
  MODIFY COLUMN kode_barang VARCHAR(20) NOT NULL;

-- 4) Unik per (jenis, kode_barang)
ALTER TABLE barang_persediaan
  ADD UNIQUE KEY uk_barang_persediaan_jenis_kode (jenis, kode_barang);

-- Cek hasil:
-- SELECT jenis, kode_barang, nama_barang FROM barang_persediaan ORDER BY jenis ASC, kode_barang ASC LIMIT 20;
