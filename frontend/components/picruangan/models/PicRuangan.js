// components/picruangan/models/PicRuangan.js

class PicRuangan {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || '';
    this.ruangan_id = data.ruangan_id || null;
    this.tgl_penugasan = data.tgl_penugasan || null;
    this.tgl_berakhir = data.tgl_berakhir || null;
    this.status = data.status || 'aktif';
    this.created_at = data.created_at || null;
    
    // Relasi data
    this.user_detail = data.user_detail || null;
    this.ruangan_detail = data.ruangan_detail || null;
    
    // Derived fields
    this.user_nama = data.user_nama || data.user_detail?.nama || data.user_id;
    this.user_nip = data.user_nip || data.user_detail?.nip || '-';
    this.user_email = data.user_email || data.user_detail?.email || '-';
    this.user_jabatan = data.user_jabatan || data.user_detail?.jabatan || '-';
    this.ruangan_nama = data.ruangan_nama || data.ruangan_detail?.nama_ruangan || `Ruangan ID: ${data.ruangan_id}`;
    this.ruangan_kode = data.ruangan_kode || data.ruangan_detail?.kode_ruangan || '';
  }

  validate() {
    const errors = {};

    if (!this.user_id) {
      errors.user_id = 'User PIC harus dipilih';
    }

    if (!this.ruangan_id) {
      errors.ruangan_id = 'Ruangan harus dipilih';
    }

    if (!this.tgl_penugasan) {
      errors.tgl_penugasan = 'Tanggal penugasan harus diisi';
    }

    if (this.tgl_penugasan && this.tgl_berakhir) {
      const tglMulai = new Date(this.tgl_penugasan);
      const tglSelesai = new Date(this.tgl_berakhir);
      if (tglSelesai < tglMulai) {
        errors.tgl_berakhir = 'Tanggal berakhir tidak boleh sebelum tanggal penugasan';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      ruangan_id: this.ruangan_id,
      tgl_penugasan: this.tgl_penugasan,
      tgl_berakhir: this.tgl_berakhir,
      status: this.status,
      created_at: this.created_at
    };
  }

  static fromAPI(data) {
    return new PicRuangan(data);
  }

  getStatusColor() {
    return this.status === 'aktif' ? 'success' : 'error';
  }

  getStatusLabel() {
    return this.status === 'aktif' ? 'Aktif' : 'Nonaktif';
  }

  getFormattedTglPenugasan() {
    if (!this.tgl_penugasan) return '-';
    try {
      const date = new Date(this.tgl_penugasan);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  }

  getFormattedTglBerakhir() {
    if (!this.tgl_berakhir) return '-';
    try {
      const date = new Date(this.tgl_berakhir);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  }

  isAktif() {
    return this.status === 'aktif' && (!this.tgl_berakhir || new Date(this.tgl_berakhir) > new Date());
  }
}

export default PicRuangan;