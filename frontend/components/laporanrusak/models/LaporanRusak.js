// components/laporanrusak/models/LaporanRusak.js

class LaporanRusak {
  constructor(data = {}) {
    this.id = data.id || null;
    this.nomor_laporan = data.nomor_laporan || '';
    this.aset_id = data.aset_id || null;
    this.ruangan_id = data.ruangan_id || null;
    this.pelapor_id = data.pelapor_id || '';
    this.tgl_laporan = data.tgl_laporan || null;
    this.deskripsi = data.deskripsi || '';
    this.foto_kerusakan = data.foto_kerusakan || [];
    this.prioritas = data.prioritas || 'sedang';
    this.status = data.status || 'draft';
    this.is_active = data.is_active !== undefined ? data.is_active : 1;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    
    // Relasi data
    this.aset = data.aset || null;
    this.ruangan = data.ruangan || null;
    this.pelapor = data.pelapor || null;
    
    // Derived fields
    this.aset_nama = data.aset_nama || data.aset?.nama_barang || `Aset ID: ${this.aset_id}`;
    this.aset_kode = data.aset_kode || data.aset?.kode_barang || '';
    this.ruangan_nama = data.ruangan_nama || data.ruangan?.nama_ruangan || `Ruangan ID: ${this.ruangan_id}`;
    this.ruangan_kode = data.ruangan_kode || data.ruangan?.kode_ruangan || '';
    this.pelapor_nama = data.pelapor_nama || data.pelapor?.nama || this.pelapor_id;
  }

  validate() {
    const errors = {};

    if (!this.aset_id) {
      errors.aset_id = 'Aset harus dipilih';
    }

    if (!this.ruangan_id) {
      errors.ruangan_id = 'Ruangan harus dipilih';
    }

    if (!this.deskripsi || this.deskripsi.trim() === '') {
      errors.deskripsi = 'Deskripsi kerusakan harus diisi';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  toJSON() {
    return {
      id: this.id,
      nomor_laporan: this.nomor_laporan,
      aset_id: this.aset_id,
      ruangan_id: this.ruangan_id,
      pelapor_id: this.pelapor_id,
      tgl_laporan: this.tgl_laporan,
      deskripsi: this.deskripsi,
      foto_kerusakan: this.foto_kerusakan,
      prioritas: this.prioritas,
      status: this.status,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromAPI(data) {
    return new LaporanRusak(data);
  }

  getStatusConfig() {
    const statusMap = {
      'diajukan': { color: 'warning', label: 'Diajukan', icon: '📝' },
      'menunggu_katim': { color: 'warning', label: 'Menunggu Katim', icon: '⏳' },
      'menunggu_ppk': { color: 'warning', label: 'Menunggu PPK', icon: '⏳' },
      'dalam_perbaikan': { color: 'primary', label: 'Dalam Perbaikan', icon: '🔧' },
      'menunggu_konfirmasi_kabag': { color: 'warning', label: 'Menunggu Konfirmasi Kabag TU', icon: '📨' },
      'menunggu_konfirmasi_user': { color: 'warning', label: 'Menunggu Konfirmasi User', icon: '🙋' },
      'selesai': { color: 'success', label: 'Selesai', icon: '🎉' },
      'ditolak': { color: 'error', label: 'Ditolak', icon: '❌' }
    };
    return statusMap[this.status] || { color: 'default', label: this.status, icon: '•' };
  }

  getPrioritasConfig() {
    const prioritasMap = {
      'rendah': { color: 'info', label: 'Rendah', icon: '🔵' },
      'sedang': { color: 'warning', label: 'Sedang', icon: '🟡' },
      'tinggi': { color: 'error', label: 'Tinggi', icon: '🟠' },
      'darurat': { color: 'error', label: 'Darurat', icon: '🔴' }
    };
    return prioritasMap[this.prioritas] || { color: 'default', label: this.prioritas, icon: '•' };
  }

  getFormattedTglLaporan() {
    if (!this.tgl_laporan) return '-';
    try {
      const date = new Date(this.tgl_laporan);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  }

  canEdit() {
    return ['diajukan'].includes(this.status);
  }

  canDelete() {
    return ['diajukan'].includes(this.status);
  }

  canVerifikasi() {
    return this.status === 'diajukan';
  }

  canKatimKirim() {
    return this.status === 'menunggu_katim';
  }

  canPPK() {
    return this.status === 'menunggu_ppk';
  }

  canCatatPerbaikan() {
    return this.status === 'dalam_perbaikan';
  }

  canKonfirmasiKabag() {
    return this.status === 'menunggu_konfirmasi_kabag';
  }

  canKonfirmasiUser() {
    return this.status === 'menunggu_konfirmasi_user';
  }
}

export default LaporanRusak;