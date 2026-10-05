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

// Escape nilai yang berasal dari data pengguna sebelum disisipkan ke HTML cetak.
// Tanpa ini, nilai seperti nama barang / keterangan / batch yang berisi
// `<img src=x onerror=...>` akan DIEKSEKUSI di jendela cetak (same-origin) -> XSS.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const toYMD = (d) => {
  if (!d) return new Date().toISOString().split('T')[0];
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const dt = new Date(s);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  } catch { return s.slice(0, 10); }
};

// ============================================
// TANDA TANGAN ELEKTRONIK (TTD dari aplikasi Talawang)
// ============================================
const kosong = (v) => v === null || v === undefined || String(v).trim() === '';

const normKunci = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

// Peta TTD dari backend: { "<kunci yang diminta>": "<url gambar>" }
const buatIndexTtd = (ttd) => {
  const map = new Map();
  Object.entries(ttd || {}).forEach(([k, v]) => {
    if (v) map.set(normKunci(k), String(v));
  });
  return map;
};

// Cari URL TTD untuk satu kolom penandatangan (coba kunci satu per satu)
const ttdUntuk = (kolom, indexTtd) => {
  if (!indexTtd || indexTtd.size === 0) return null;
  for (const kunci of kolom.kunci || []) {
    const url = indexTtd.get(normKunci(kunci));
    if (url) return url;
  }
  return null;
};

// Preload gambar TTD; cb dipanggil dengan daftar URL yang GAGAL dimuat agar
// TTD yang tidak tersedia tidak muncul sebagai ikon gambar rusak.
const preloadImages = (urls, cb) => {
  const unik = [...new Set((urls || []).filter(Boolean))];
  if (unik.length === 0) return cb([]);

  const gagal = [];
  let sisa = unik.length;
  let selesai = false;
  const done = (url, ok) => {
    if (selesai) return;
    if (!ok) gagal.push(url);
    sisa -= 1;
    if (sisa <= 0) { selesai = true; cb(gagal); }
  };

  unik.forEach((url) => {
    const img = new Image();
    img.onload = () => done(url, true);
    img.onerror = () => done(url, false);
    img.src = url;
  });

  // Pengaman: jangan menunggu terlalu lama
  setTimeout(() => { if (!selesai) { selesai = true; cb(gagal); } }, 6000);
};

// Daftar kolom tanda tangan untuk SPB & SBBK.
// `kunci` = kandidat identitas yang dicoba berurutan (id -> username -> nama).
export const penandatanganSPBSBBK = (group) => {
  const g = group || {};
  const picGudang = g.delivered_by || '';
  const pemohon = g.requested_by || '';
  const katim = g.katim_nama || g.approved_katim_by || '';
  const kabag = g.approved_kabag_by || '';

  return {
    diserahkan: {
      label: 'Diserahkan',
      jabatan: 'Pengelola Gudang',
      nama: picGudang,
      kunci: [g.delivered_by],
    },
    diterima: {
      label: 'Diterima',
      jabatan: 'Pemohon',
      nama: pemohon,
      kunci: [g.requested_by],
    },
    katim: {
      label: 'Mengetahui',
      jabatan: 'Ketua Tim Kerja',
      nama: katim,
      kunci: [g.katim_id, g.approved_katim_by, g.katim_nama],
    },
    kabag: {
      label: 'Mengetahui',
      jabatan: 'Kabag Tata Usaha',
      nama: kabag,
      kunci: [g.approved_kabag_by],
    },
  };
};

/** Kunci identitas TTD yang perlu diminta ke backend untuk SPB & SBBK. */
export const kunciPenandatanganSPBSBBK = (group) => {
  const semua = penandatanganSPBSBBK(group);
  return [
    ...new Set(
      Object.values(semua)
        .flatMap((k) => k.kunci || [])
        .filter((k) => !kosong(k))
        .map((k) => String(k).trim())
    ),
  ];
};

// Tabel tanda tangan: satu baris berisi kolom-kolom penandatangan.
// TTD gambar tampil kalau tersedia; kalau tidak, tetap ada ruang tanda tangan.
const buildSignatureTable = (kolom, indexTtd) => `
  <table class="ttd">
    <tr>
      ${kolom.map((k) => {
        const url = ttdUntuk(k, indexTtd);
        const nama = kosong(k.nama) ? '................................' : k.nama;
        return `
      <td>
        <div class="lbl-ttd">${escapeHtml(k.label)}</div>
        <div class="jab-ttd">${escapeHtml(k.jabatan)}</div>
        ${
          url
            ? `<div class="ttdbox"><img class="ttd-img" src="${escapeHtml(url)}" alt="TTD ${escapeHtml(nama)}" onerror="var b=this.parentNode;b.className='space-ttd';b.innerHTML='';" /></div>`
            : '<div class="space-ttd"></div>'
        }
        <div class="nama-ttd">${escapeHtml(nama)}</div>
      </td>`;
      }).join('')}
    </tr>
  </table>
`;

const buildDoc = ({ judul, nomor, tanggal, unit, rows, kolom, indexTtd, isLast }) => `
  <div class="sheet${isLast ? ' last' : ''}">
    <div class="doc-code">${KODE_DOKUMEN}</div>
    <div class="kop">
      <img class="logo" src="${LOGO_URL}" alt="Logo BADAN POM" />
      <div class="instansi">
        <div class="badan">BADAN POM</div>
        <div class="nama-lengkap">${INSTANSI}</div>
      </div>
      <div class="title">${escapeHtml(judul)}</div>
    </div>
    <div class="meta">
      <p><span class="lbl">Unit Seksi/Sub Bagian</span><span class="sep">:</span> ${escapeHtml(unit)}</p>
      <p><span class="lbl">Nomor</span><span class="sep">:</span> ${escapeHtml(nomor)}</p>
      <p><span class="lbl">Tanggal</span><span class="sep">:</span> ${escapeHtml(tanggal)}</p>
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
            <td class="c no">${escapeHtml(r.no)}</td>
            <td class="nama">${escapeHtml(r.nama)}${r.kode ? `<div class="kode">Kode: ${escapeHtml(r.kode)}</div>` : ''}</td>
            <td class="c satuan">${escapeHtml(r.satuan)}</td>
            <td class="c jml">${escapeHtml(r.diminta)}</td>
            <td class="c jml">${escapeHtml(r.jumlah)}</td>
            <td class="c ket">${escapeHtml(r.ket)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${buildSignatureTable(kolom, indexTtd)}
  </div>
`;

/**
 * Cetak SPB & SBBK untuk suatu group permintaan.
 * @param {object} opts
 * @param {object} opts.group - group permintaan/pengeluaran
 * @param {'atk'|'reagen'} opts.tipe - jenis modul
 * @param {Record<string,string>} [opts.ttd] - peta kunci identitas -> URL gambar TTD
 *   (dari utils/ttdPenandatangan.js: `ambilPetaTtd`). Opsional — tanpa TTD
 *   dokumen tetap dicetak dengan ruang tanda tangan kosong.
 */
export const cetakSPBSBBK = ({ group, tipe = 'atk', ttd = {} } = {}) => {
  if (!group) return;

  const kodeHex = (group.group_id || '00000000').replace(/-/g, '').slice(0, 6);
  const seq = String((parseInt(kodeHex, 16) || 0) % 999).padStart(3, '0');
  const tanggal = toYMD(group.delivered_at || group.tanggal_permintaan || new Date().toISOString().split('T')[0]);
  const tanggalCompact = tanggal.replace(/-/g, '');

  const kolom = penandatanganSPBSBBK(group);

  // Selalu tampilkan 10 baris (isi + kosong)
  const items = (group.items || []).map((it, i) => ({
    no: i + 1,
    kode: it.kode_barang || '',
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

  // Dokumen dibangun per-render supaya indeks TTD yang valid bisa digunakan
  const buatHtml = (indexTtd) => {
    const spb = buildDoc({
      judul: 'SURAT PERMINTAAN BARANG (SPB)',
      nomor: `PBP-${tanggalCompact}-${seq}`,
      tanggal,
      unit: 'Tata Usaha',
      rows,
      kolom: [kolom.diserahkan, kolom.diterima, kolom.katim],
      indexTtd,
      isLast: false,
    });

    const sbbk = buildDoc({
      judul: 'SURAT BUKTI BARANG KELUAR (SBBK)',
      nomor: `SBK-${tanggalCompact}-${seq}`,
      tanggal,
      unit: 'Tata Usaha',
      rows,
      kolom: [kolom.diserahkan, kolom.diterima, kolom.kabag],
      indexTtd,
      isLast: true,
    });

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>SPB &amp; SBBK</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; margin: 0; }
  .sheet {
    width: 210mm; min-height: 297mm; padding: 10mm 14mm 12mm;
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
  td.nama .kode { font-size: 10.5px; font-weight: 600; color: #333; margin-top: 1px; }
  th.satuan, td.satuan { width: 12%; }
  th.jml, td.jml { width: 14%; }
  th.ket, td.ket { width: 19%; }

  table.ttd { width: 92%; margin: 30px auto 0 auto; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
  table.ttd td { text-align: center; vertical-align: top; }
  .lbl-ttd { font-weight: 700; }
  .jab-ttd { margin-top: 2px; }
  .space-ttd { height: 46px; }
  .ttdbox { height: 46px; display: flex; align-items: flex-end; justify-content: center; }
  .ttd-img { max-height: 44px; max-width: 92%; object-fit: contain; }
  .nama-ttd { font-weight: 700; text-decoration: underline; }
</style>
</head>
<body>
  ${spb}
  ${sbbk}
</body>
</html>`;
  };

  // Cetak: TTD dicek dulu (kalau gagal dimuat, dilewati agar tidak ada gambar
  // rusak), lalu logo dipreload sebelum jendela cetak dibuka.
  const lanjut = (ttdValid) => {
    const html = buatHtml(buatIndexTtd(ttdValid));
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

  const ttdAsli = ttd || {};
  const ttdUrls = Object.values(ttdAsli).filter(Boolean);
  if (ttdUrls.length === 0) {
    lanjut(ttdAsli);
    return;
  }

  preloadImages(ttdUrls, (gagal) => {
    const gagalSet = new Set(gagal);
    const ttdValid = Object.fromEntries(
      Object.entries(ttdAsli).filter(([, url]) => url && !gagalSet.has(url))
    );
    lanjut(ttdValid);
  });
};
