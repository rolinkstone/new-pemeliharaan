// components/ruangan/models/Ruangan.js

/**
 * Model Ruangan
 * Representasi data ruangan dari database
 */
class Ruangan {
  constructor(data = {}) {
    this.id = data.id || null;
    this.kode_ruangan = data.kode_ruangan || '';
    this.nama_ruangan = data.nama_ruangan || '';
    this.deskripsi = data.deskripsi || '';
    this.lokasi = data.lokasi || '';
    this.is_active = data.is_active !== undefined ? data.is_active : 1;
    this.created_at = data.created_at || null;
  }

  /**
   * Validasi data ruangan
   * @returns {Object} - Hasil validasi { isValid, errors }
   */
  validate() {
    const errors = {};

    if (!this.kode_ruangan || this.kode_ruangan.trim() === '') {
      errors.kode_ruangan = 'Kode ruangan harus diisi';
    } else if (this.kode_ruangan.length > 20) {
      errors.kode_ruangan = 'Kode ruangan maksimal 20 karakter';
    }

    if (!this.nama_ruangan || this.nama_ruangan.trim() === '') {
      errors.nama_ruangan = 'Nama ruangan harus diisi';
    } else if (this.nama_ruangan.length > 100) {
      errors.nama_ruangan = 'Nama ruangan maksimal 100 karakter';
    }

    if (this.lokasi && this.lokasi.length > 255) {
      errors.lokasi = 'Lokasi maksimal 255 karakter';
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
      kode_ruangan: this.kode_ruangan,
      nama_ruangan: this.nama_ruangan,
      deskripsi: this.deskripsi || null,
      lokasi: this.lokasi || null,
      is_active: this.is_active,
      created_at: this.created_at
    };
  }

  /**
   * Create from API response
   * @param {Object} data
   * @returns {Ruangan}
   */
  static fromAPI(data) {
    return new Ruangan({
      id: data.id,
      kode_ruangan: data.kode_ruangan,
      nama_ruangan: data.nama_ruangan,
      deskripsi: data.deskripsi,
      lokasi: data.lokasi,
      is_active: data.is_active,
      created_at: data.created_at
    });
  }

  /**
   * Get status badge color
   * @returns {string}
   */
  getStatusColor() {
    return this.is_active === 1 ? 'success' : 'error';
  }

  /**
   * Get status label
   * @returns {string}
   */
  getStatusLabel() {
    return this.is_active === 1 ? 'Aktif' : 'Tidak Aktif';
  }

  /**
   * Get formatted created date
   * @returns {string}
   */
  getFormattedCreatedDate() {
    if (!this.created_at) return '-';
    try {
      const date = new Date(this.created_at);
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
}

export default Ruangan;