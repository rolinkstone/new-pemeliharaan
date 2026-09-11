// components/asetruangan/models/AsetRuangan.js

/**
 * Model AsetRuangan
 * Representasi data posisi aset di ruangan
 */
class AsetRuangan {
  constructor(data = {}) {
    this.id = data.id || null;
    this.aset_id = data.aset_id || null;
    this.ruangan_id = data.ruangan_id || null;
    this.tgl_masuk = data.tgl_masuk || null;
    this.tgl_keluar = data.tgl_keluar || null;
    this.status = data.status || 'aktif';
    this.keterangan = data.keterangan || '';
    this.created_at = data.created_at || null;
    
    // Relasi data (opsional, untuk tampilan)
    this.aset = data.aset || null;
    this.ruangan = data.ruangan || null;
  }

  /**
   * Validasi data aset ruangan
   * @returns {Object} - Hasil validasi { isValid, errors }
   */
  validate() {
    const errors = {};

    if (!this.aset_id) {
      errors.aset_id = 'Aset harus dipilih';
    }

    if (!this.ruangan_id) {
      errors.ruangan_id = 'Ruangan harus dipilih';
    }

    if (!this.tgl_masuk) {
      errors.tgl_masuk = 'Tanggal masuk harus diisi';
    }

    // Validasi tgl_keluar tidak boleh lebih kecil dari tgl_masuk
    if (this.tgl_masuk && this.tgl_keluar) {
      const masuk = new Date(this.tgl_masuk);
      const keluar = new Date(this.tgl_keluar);
      if (keluar < masuk) {
        errors.tgl_keluar = 'Tanggal keluar tidak boleh sebelum tanggal masuk';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Convert to JSON for API
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      aset_id: this.aset_id,
      ruangan_id: this.ruangan_id,
      tgl_masuk: this.tgl_masuk,
      tgl_keluar: this.tgl_keluar,
      status: this.status,
      keterangan: this.keterangan || null,
      created_at: this.created_at
    };
  }

  /**
   * Create from API response
   * @param {Object} data
   * @returns {AsetRuangan}
   */
  static fromAPI(data) {
    return new AsetRuangan({
      id: data.id,
      aset_id: data.aset_id,
      ruangan_id: data.ruangan_id,
      tgl_masuk: data.tgl_masuk,
      tgl_keluar: data.tgl_keluar,
      status: data.status,
      keterangan: data.keterangan,
      created_at: data.created_at,
      aset: data.aset,
      ruangan: data.ruangan
    });
  }

  /**
   * Get status badge color
   * @returns {string}
   */
  getStatusColor() {
    const colors = {
      'aktif': 'success',
      'dipindah': 'warning',
      'dihapuskan': 'error'
    };
    return colors[this.status] || 'default';
  }

  /**
   * Get status label in Indonesian
   * @returns {string}
   */
  getStatusLabel() {
    const labels = {
      'aktif': 'Aktif',
      'dipindah': 'Dipindah',
      'dihapuskan': 'Dihapuskan'
    };
    return labels[this.status] || this.status;
  }

  /**
   * Get formatted tanggal masuk
   * @returns {string}
   */
  getFormattedTglMasuk() {
    if (!this.tgl_masuk) return '-';
    try {
      const date = new Date(this.tgl_masuk);
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

  /**
   * Get formatted tanggal keluar
   * @returns {string}
   */
  getFormattedTglKeluar() {
    if (!this.tgl_keluar) return '-';
    try {
      const date = new Date(this.tgl_keluar);
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

  /**
   * Get aset name (if relation loaded)
   * @returns {string}
   */
  getAsetName() {
    return this.aset?.nama_barang || `Aset ID: ${this.aset_id}`;
  }

  /**
   * Get ruangan name (if relation loaded)
   * @returns {string}
   */
  getRuanganName() {
    return this.ruangan?.nama_ruangan || `Ruangan ID: ${this.ruangan_id}`;
  }

  /**
   * Get ruangan kode (if relation loaded)
   * @returns {string}
   */
  getRuanganKode() {
    return this.ruangan?.kode_ruangan || '';
  }

  /**
   * Check if aset is currently active in this room
   * @returns {boolean}
   */
  isActive() {
    return this.status === 'aktif' && !this.tgl_keluar;
  }
}

export default AsetRuangan;