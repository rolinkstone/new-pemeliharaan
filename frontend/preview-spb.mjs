// Preview generator — menghasilkan HTML cetak SPB & SBBK dari module asli
import fs from 'fs';

global.window = {
  open: () => ({
    document: {
      write: (html) => { fs.writeFileSync('preview_spb_sbbk.html', html); console.log('Preview ditulis: preview_spb_sbbk.html'); },
      close: () => {},
    },
    focus: () => {},
    print: () => {},
    set onafterprint(v) {},
  }),
};
global.alert = () => {};

const { cetakSPBSBBK } = await import('./utils/cetakSPBSBBK.js');

const group = {
  group_id: 'b08230d3-7b8f-4fd3-af8a-d712f879bafe',
  requested_by: 'Abel',
  delivered_by: 'I Putu Hendrawan',
  katim_nama: 'Batman',
  approved_kabag_by: 'Superman',
  delivered_at: '2025-04-10T00:00:00.000Z',
  tanggal_permintaan: '2025-04-10',
  catatan: '',
  items: [
    { nama_barang: 'Lem Kertas Lem Stick', satuan: 'Buah', jumlah: 1, jumlah_diminta: 1, kategori: 'Konsumsi' },
    { nama_barang: 'Isi Staples Besar', satuan: 'Buah', jumlah: 2, jumlah_diminta: 1, kategori: 'Konsumsi' },
    { nama_barang: 'kalkulator', satuan: 'Buah', jumlah: 1, jumlah_diminta: 1, kategori: 'Konsumsi' },
    { nama_barang: 'Binder Klip 105', satuan: 'Kotak', jumlah: 1, jumlah_diminta: 1, kategori: 'Konsumsi' },
  ],
};

cetakSPBSBBK({ group, tipe: 'atk' });
