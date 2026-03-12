// utils/kegiatanHelpers.js
export const formatDateForDisplay = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
};

export const formatRupiah = (number) => {
  if (number === undefined || number === null) return '0';
  return Number(number).toLocaleString('id-ID');
};

export const validateFormData = (formData) => {
  const errors = [];
  
  if (!formData.kegiatan?.trim()) errors.push('Nama Kegiatan wajib diisi');
  if (!formData.mak?.trim()) errors.push('MAK wajib diisi');
  
  return errors;
};

export const prepareKegiatanPayload = (formData, pegawaiList) => {
  return {
    ...formData,
    pegawai: pegawaiList.map(pegawai => ({
      nama: pegawai.nama || '',
      nip: pegawai.nip || '',
      jabatan: pegawai.jabatan || '',
      total_biaya: pegawai.total_biaya || 0,
      biaya: pegawai.biaya.map(biaya => ({
        transportasi: biaya.transportasi
          .filter(t => t.trans || t.harga || t.total)
          .map(t => ({
            trans: t.trans || '',
            harga: Number(t.harga) || 0,
            total: Number(t.total) || 0
          })),
        uang_harian_items: biaya.uang_harian_items
          .filter(u => u.jenis || u.qty || u.harga || u.total)
          .map(u => ({
            jenis: u.jenis || '',
            qty: Number(u.qty) || 0,
            harga: Number(u.harga) || 0,
            total: Number(u.total) || 0
          })),
        penginapan_items: biaya.penginapan_items
          .filter(p => p.jenis || p.qty || p.harga || p.total)
          .map(p => ({
            jenis: p.jenis || '',
            qty: Number(p.qty) || 0,
            harga: Number(p.harga) || 0,
            total: Number(p.total) || 0
          }))
      }))
    }))
  };
};



export const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
});