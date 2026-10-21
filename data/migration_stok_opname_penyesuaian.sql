-- =============================================
-- Migration: Penyesuaian Stok Opname (Persediaan / ATK)
-- Mencatat selisih opname sebagai transaksi masuk/keluar penyesuaian
-- agar laporan mutasi menampilkan stok awal yang benar.
-- Hanya memengaruhi laporan mutasi; tidak muncul di tab Permintaan (SPB/SBBK).
-- =============================================

CREATE TABLE IF NOT EXISTS stok_opname_penyesuaian (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stok_opname_id INT DEFAULT NULL,
    barang_id INT NOT NULL,
    tipe ENUM('masuk', 'keluar') NOT NULL,
    jumlah INT NOT NULL,
    tanggal DATE NOT NULL,
    catatan TEXT DEFAULT NULL,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barang_id) REFERENCES barang_persediaan(id) ON DELETE CASCADE,
    FOREIGN KEY (stok_opname_id) REFERENCES stok_opname(id) ON DELETE CASCADE,
    INDEX idx_barang_tanggal (barang_id, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
