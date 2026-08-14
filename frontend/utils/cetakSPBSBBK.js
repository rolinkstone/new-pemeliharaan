// utils/cetakSPBSBBK.js
// Cetak dua dokumen setelah permintaan disetujui Kabag TU:
//   1. SPB  (Surat Permintaan Barang)  — mengetahui: Ketua Tim Kerja (Katim)
//   2. SBBK (Surat Bukti Barang Keluar) — mengetahui: Kabag TU

const KODE_DOKUMEN = 'POM-14.02/CEM.02/SOP.01/IK.16A.01/F.03';
const INSTANSI = 'BADAN PENGAWAS OBAT DAN MAKANAN';

// Logo BADAN POM — file statis frontend (frontend/public/images/BADAN_POM.png)
const LOGO_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/images/BADAN_POM.png`
    : '/images/BADAN_POM.png';

// Preload logo di halaman induk agar pasti termuat saat window print dibuka
const preloadLogo = (cb) => {
  let fired = false;
  const done = () => { if (!fired) { fired = true; cb(); } };
  const img = new Image();
  img.onload = done;
  img.onerror = done; // tetap lanjut walau logo gagal dimuat
  img.src = LOGO_URL;
  setTimeout(done, 1200); // pengaman: jangan menunggu terlalu lama
};

const LAB_LABEL = { pangan: 'LAB Pangan', mikro: 'LAB Mikro', terano: 'LAB Terano' };
const getLabLabel = (v) => LAB_LABEL[v] || (v ? v : '');

const toYMD = (d) => {
  if (!d) return new Date().toISOString().split('T')[0];
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const dt = new Date(s);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  } catch { return s.slice(0, 10); }
};

const buildDoc = ({ judul, nomor, tanggal, unit, rows, diserahkan, diterima, mengetahui, jabatan, isLast }) => `
  <div class="sheet${isLast ? ' last' : ''}">
    <div class="doc-code">${KODE_DOKUMEN}</div>
    <div class="kop">
      <img class="logo" src="${LOGO_URL}" alt="Logo BADAN POM" />
      <div class="instansi">
        <div class="badan">BADAN POM</div>
        <div class="nama-lengkap">${INSTANSI}</div>
      </div>
      <div class="title">${judul}</div>
    </div>
    <div class="meta">
      <p><span class="lbl">Unit Seksi/Sub Bagian</span><span class="sep">:</span> ${unit}</p>
      <p><span class="lbl">Nomor</span><span class="sep">:</span> ${nomor}</p>
      <p><span class="lbl">Tanggal</span><span class="sep">:</span> ${tanggal}</p>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th class="c no">NO</th>
          <th class="nama">NAMA BARANG</th>
          <th class="c satuan">SATUAN</th>
          <th class="c jml">JUMLAH<br/>PERMINTAAN</th>
          <th class="c jml">JUMLAH<br/>DISETUJUI</th>
          <th class="c ket">KETERANGAN</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td class="c no">${r.no}</td>
            <td class="nama">${r.nama}</td>
            <td class="c satuan">${r.satuan}</td>
            <td class="c jml">${r.diminta}</td>
            <td class="c jml">${r.jumlah}</td>
            <td class="c ket">${r.ket}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <table class="ttd">
      <tr>
        <td>
          <div class="lbl-ttd">Diserahkan</div>
          <div class="jab-ttd">Pengelola Gudang</div>
          <div class="space-ttd"></div>
          <div class="nama-ttd">${diserahkan}</div>
        </td>
        <td>
          <div class="lbl-ttd">Diterima</div>
          <div class="jab-ttd">Pemohon</div>
          <div class="space-ttd"></div>
          <div class="nama-ttd">${diterima}</div>
        </td>
        <td>
          <div class="lbl-ttd">Mengetahui</div>
          <div class="jab-ttd">${jabatan}</div>
          <div class="space-ttd"></div>
          <div class="nama-ttd">${mengetahui}</div>
        </td>
      </tr>
    </table>
  </div>
`;

/**
 * Cetak SPB & SBBK untuk suatu group permintaan.
 * @param {object} opts
 * @param {object} opts.group - group permintaan/pengeluaran
 * @param {'atk'|'reagen'} opts.tipe - jenis modul
 */
export const cetakSPBSBBK = ({ group, tipe = 'atk' }) => {
  if (!group) return;

  const kodeHex = (group.group_id || '00000000').replace(/-/g, '').slice(0, 6);
  const seq = String((parseInt(kodeHex, 16) || 0) % 999).padStart(3, '0');
  const tanggal = toYMD(group.delivered_at || group.tanggal_permintaan || new Date().toISOString().split('T')[0]);
  const tanggalCompact = tanggal.replace(/-/g, '');

  const picGudang = group.delivered_by || '................................';
  const user = group.requested_by || '................................';
  const katim = group.katim_nama || group.approved_katim_by || '................................';
  const kabag = group.approved_kabag_by || '................................';

  // Selalu tampilkan 10 baris (isi + kosong)
  const items = (group.items || []).map((it, i) => ({
    no: i + 1,
    nama: it.nama_barang || '',
    satuan: tipe === 'reagen' ? (it.satuan || 'Botol') : (it.satuan || ''),
    jumlah: tipe === 'reagen' ? (it.jumlah_botol ?? it.jumlah ?? '') : (it.jumlah ?? ''),
    diminta: tipe === 'reagen' ? (it.jumlah_diminta ?? it.jumlah_botol ?? '') : (it.jumlah_diminta ?? it.jumlah ?? ''),
    ket: tipe === 'reagen'
      ? [getLabLabel(it.lab_tujuan), it.berat_volume, it.no_batch ? `Batch:${it.no_batch}` : ''].filter(Boolean).join(' ')
      : (it.kategori || ''),
  }));
  const rows = [];
  for (let i = 0; i < 10; i++) {
    rows.push(items[i] || { no: i + 1, nama: '', satuan: '', jumlah: '', diminta: '', ket: '' });
  }

  const spb = buildDoc({
    judul: 'SURAT PERMINTAAN BARANG (SPB)',
    nomor: `PBP-${tanggalCompact}-${seq}`,
    tanggal,
    unit: 'Tata Usaha',
    rows,
    diserahkan: picGudang,
    diterima: user,
    mengetahui: katim,
    jabatan: 'Ketua Tim Kerja',
    isLast: false,
  });

  const sbbk = buildDoc({
    judul: 'SURAT BUKTI BARANG KELUAR (SBBK)',
    nomor: `SBK-${tanggalCompact}-${seq}`,
    tanggal,
    unit: 'Tata Usaha',
    rows,
    diserahkan: picGudang,
    diterima: user,
    mengetahui: kabag,
    jabatan: 'Kabag Tata Usaha',
    isLast: true,
  });

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>SPB &amp; SBBK</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; }
  .sheet {
    width: 210mm; min-height: 297mm; padding: 10mm 14mm 12mm;
    background: #fdf2f8;               /* pink */
    -webkit-print-color-adjust: exact; /* agar pink ikut tercetak */
    print-color-adjust: exact;
    border: 2px solid #000;
    position: relative;
    page-break-after: always;
  }
  .sheet.last { page-break-after: auto; }

  .doc-code { position: absolute; top: 6mm; right: 10mm; font-size: 10px; color: #000; }

  .kop { text-align: center; margin-top: 8mm; }
  .logo { width: 84px; height: 84px; display: inline-block; }
  .instansi { margin-top: 4px; }
  .badan { font-size: 19px; font-weight: 800; letter-spacing: 2px; }
  .nama-lengkap { font-size: 12px; font-weight: 600; margin-top: 1px; }
  .title { font-size: 17px; font-weight: 800; text-decoration: underline; margin-top: 8px; }

  .meta { margin-top: 12px; font-size: 13px; }
  .meta p { margin: 2px 0; }
  .meta .lbl { display: inline-block; width: 150px; }
  .meta .sep { display: inline-block; width: 16px; }

  table.items { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  table.items th, table.items td { border: 1px solid #000; padding: 4px 5px; vertical-align: middle; }
  table.items thead th { font-weight: 700; }
  .c { text-align: center; }
  th.no, td.no { width: 5%; }
  th.nama, td.nama { text-align: left; width: 36%; }
  th.satuan, td.satuan { width: 12%; }
  th.jml, td.jml { width: 14%; }
  th.ket, td.ket { width: 19%; }

  table.ttd { width: 92%; margin: 30px auto 0 auto; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
  table.ttd td { text-align: center; vertical-align: top; }
  .lbl-ttd { font-weight: 700; }
  .jab-ttd { margin-top: 2px; }
  .space-ttd { height: 46px; }
  .nama-ttd { font-weight: 700; text-decoration: underline; }
</style>
</head>
<body>
  ${spb}
  ${sbbk}
</body>
</html>`;

  preloadLogo(() => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
      w.onafterprint = () => setTimeout(() => w.close(), 500);
    }, 400);
  });
};
