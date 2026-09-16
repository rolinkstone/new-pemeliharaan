// utils/cetakLaporanRusak.js
// Cetak / simpan PDF untuk modul Laporan Kerusakan Aset (laporanrusak).
//
// Cara kerja (sama seperti cetakSPBSBBK):
//   1. Bangun dokumen HTML ukuran A4 lengkap dengan kop instansi.
//   2. Buka window baru lalu panggil window.print().
//   3. Pada dialog print pilih "Save as PDF" / "Simpan sebagai PDF".
//
// Tersedia 2 fungsi:
//   - cetakLaporanRusak(laporan, opts)  -> formulir 1 laporan (lengkap + foto + alur + ttd)
//   - cetakDaftarLaporanRusak(opts)     -> rekapitulasi banyak laporan (A4 landscape)

const INSTANSI = 'BADAN PENGAWAS OBAT DAN MAKANAN';
const APP_NAME = 'Aplikasi Pemeliharaan Aset';

const LOGO_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/images/BADAN_POM.png`
    : '/images/BADAN_POM.png';

// ============================================
// LABEL
// ============================================
const STATUS_LABEL = {
  diajukan: 'Diajukan',
  menunggu_katim: 'Menunggu Katim',
  menunggu_ppk: 'Menunggu PPK',
  dalam_perbaikan: 'Dalam Perbaikan',
  menunggu_konfirmasi_kabag: 'Menunggu Konfirmasi Kabag TU',
  menunggu_konfirmasi_user: 'Menunggu Konfirmasi User',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
};

const PRIORITAS_LABEL = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
  darurat: 'Darurat',
};

const HASIL_PERBAIKAN_LABEL = {
  internal: 'Berhasil (Tim Internal)',
  eksternal: 'Berhasil (Vendor Eksternal)',
  gagal: 'Gagal',
};

// ============================================
// HELPER UMUM
// ============================================
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const nl2br = (value) => escapeHtml(value).replace(/\r?\n/g, '<br/>');

const isEmptyValue = (v) =>
  v === null || v === undefined || String(v).trim() === '' || String(v).trim() === '-';

const orDash = (v) => (isEmptyValue(v) ? '-' : v);

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const fmtTanggal = (value) => {
  const d = toDate(value);
  if (!d) return isEmptyValue(value) ? '-' : escapeHtml(value);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Normalisasi nilai rupiah menjadi number.
// Mendukung:
//   number        : 1300000
//   desimal DB    : "1300000.00"  / "1300000,00" -> 1300000
//   pemisah ribuan: "1.300.000"   / "1,300,000"  -> 1300000
//   prefix Rp     : "Rp 1.300.000"
// Mengembalikan null bila nilainya bukan angka tunggal (teks bebas / rentang),
// sehingga pemanggil bisa menampilkan teksnya apa adanya.
const parseRupiahNumber = (value) => {
  if (isEmptyValue(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const s = String(value).trim();
  if (!s) return null;
  const bersih = s.replace(/rp\.?/gi, '').replace(/[\s\u00a0]/g, '');
  // Teks bebas ("kurang lebih 2 juta") atau rentang ("1.000.000 - 2.000.000")
  if (/[a-zA-Z]/.test(bersih) || /[-/]/.test(bersih)) return null;
  if (!/^[\d.,]+$/.test(bersih)) return null;

  // Bagian desimal (mis. ".00" pada "1300000.00") dibuang, sisanya digit utuh.
  // Pemisah ribuan tidak dianggap desimal karena diikuti tepat 3 digit.
  const desimal = bersih.match(/[.,]\d{1,2}$/);
  const utuh = desimal ? bersih.slice(0, bersih.length - desimal[0].length) : bersih;
  const angka = utuh.replace(/[.,]/g, '');
  if (!angka) return null;
  const num = Number(angka);
  return Number.isFinite(num) ? num : null;
};

const fmtRupiah = (value) => {
  if (isEmptyValue(value)) return '';
  const num = parseRupiahNumber(value);
  // Bukan angka tunggal (teks bebas / rentang) -> tampilkan apa adanya
  if (num === null) return String(value).trim();
  return `Rp ${num.toLocaleString('id-ID')}`;
};

const getApiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
  return base.replace(/\/api\/?$/, '');
};

const resolveFotoUrl = (photo) => {
  if (!photo) return null;
  let url = typeof photo === 'string' ? photo : photo.url || photo.preview || null;
  if (!url || typeof url !== 'string') return null;
  url = url.trim();
  if (!url) return null;
  if (/^data:/i.test(url)) return url;
  url = url.replace('/api/uploads/', '/uploads/');
  if (/^https?:\/\//i.test(url)) return url;
  const base = getApiBase();
  if (url.startsWith('/uploads/')) return `${base}${url}`;
  if (url.startsWith('/')) return `${base}/uploads${url}`;
  return `${base}/uploads/${url}`;
};

const fotoUrlsDari = (laporan) => {
  const raw = laporan?.foto_kerusakan;
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s);
        list = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        list = [s];
      }
    } else if (s) {
      list = [s];
    }
  } else if (raw && typeof raw === 'object') {
    list = [raw];
  }
  return list.map(resolveFotoUrl).filter(Boolean);
};

// ============================================
// PRELOAD ASET GAMBAR (logo + foto + TTD)
// ============================================
// cb dipanggil dengan daftar URL yang GAGAL dimuat, sehingga TTD/foto yang
// tidak tersedia bisa dilewati (tidak muncul ikon gambar rusak).
const preloadImages = (urls, cb) => {
  const unique = [...new Set((urls || []).filter(Boolean))];
  if (unique.length === 0) return cb([]);

  const gagal = [];
  let remaining = unique.length;
  let finished = false;
  const done = (url, ok) => {
    if (finished) return;
    if (!ok) gagal.push(url);
    remaining -= 1;
    if (remaining <= 0) {
      finished = true;
      cb(gagal);
    }
  };

  unique.forEach((url) => {
    const img = new Image();
    img.onload = () => done(url, true);
    img.onerror = () => done(url, false);
    img.src = url;
  });

  // Pengaman: jangan menunggu terlalu lama
  setTimeout(() => {
    if (!finished) {
      finished = true;
      cb(gagal);
    }
  }, 6000);
};

// ============================================
// CETAK DOKUMEN
// ============================================
// Cara 1 (utama): tulis dokumen ke iframe tersembunyi lalu print dari iframe.
//   - tidak kena popup blocker
//   - tidak ada masalah cross-origin seperti window.open('', '_blank')
// Cara 2 (fallback): buka window baru lalu print.
const cetakViaIframe = (html) => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Dokumen cetak');
  // Diletakkan di luar layar (bukan 0x0) supaya layout A4 tetap benar
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:210mm;min-height:297mm;border:0;background:#fff;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (error) {
      console.warn('Print via iframe gagal, mencoba window baru:', error.message);
      cetakViaWindow(html);
    } finally {
      // Bersihkan iframe setelah user selesai dengan dialog cetak
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 60000);
    }
  }, 500);
};

const cetakViaWindow = (html) => {
  const w = window.open('', '_blank', 'width=1100,height=850');
  if (!w) {
    alert('Pop-up diblokir. Izinkan pop-up untuk mencetak / menyimpan PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
      w.onafterprint = () => setTimeout(() => w.close(), 500);
    } catch (error) {
      console.error('Gagal membuka dialog print:', error);
    }
  }, 500);
};

const openPrintWindow = (html, images = []) => {
  preloadImages([LOGO_URL, ...images], () => {
    cetakViaIframe(html);
  });
};

// ============================================
// STYLE BERSAMA
// ============================================
// Catatan: margin cetak diatur lewat @page (bukan padding .sheet) supaya
// dokumen yang lebih dari 1 halaman tetap punya margin di setiap halaman.
const baseStyles = (orientation = 'portrait') => `
  @page { size: A4 ${orientation}; margin: 12mm 13mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Times New Roman', Times, serif;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { position: relative; }

  .kop { text-align: center; margin-top: 2mm; }
  .logo { width: 74px; height: 74px; display: inline-block; }
  .instansi { margin-top: 3px; }
  .badan { font-size: 18px; font-weight: 800; letter-spacing: 2px; }
  .nama-lengkap { font-size: 11.5px; font-weight: 600; margin-top: 1px; }
  .title { font-size: 16px; font-weight: 800; text-decoration: underline; margin-top: 7px; }
  .subtitle-doc { font-size: 11.5px; margin-top: 3px; }

  .section-title {
    font-size: 12.5px; font-weight: 700; margin: 12px 0 5px 0;
    background: #ececec; border: 1px solid #000; padding: 3px 6px;
    page-break-after: avoid;
  }

  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table th, table td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  table th { font-weight: 700; background: #f2f2f2; text-align: left; }
  table td.center, table th.center { text-align: center; }
  table.meta td.lbl { width: 20%; font-weight: 600; background: #fafafa; }
  table.meta td.val { width: 30%; }
  table.meta.no-border, table.meta.no-border td { border: none; padding: 2px 0; }

  .note { font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; }
  .muted { color: #333; font-size: 10.5px; }

  .fotos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .fotos figure {
    width: 31.5%; border: 1px solid #000; padding: 3px; text-align: center;
    page-break-inside: avoid;
  }
  .fotos img { width: 100%; height: 42mm; object-fit: contain; display: block; }
  .fotos figcaption { font-size: 10px; margin-top: 2px; }

  table.ttd { width: 100%; margin-top: 14px; table-layout: fixed; page-break-inside: avoid; }
  table.ttd td { border: none; text-align: center; vertical-align: top; padding: 6px 4px; }
  .ttd-jabatan { font-size: 11.5px; }
  .ttd-space { height: 52px; }
  .ttd-ttdbox { height: 22mm; display: flex; align-items: flex-end; justify-content: center; }
  .ttd-img { max-height: 22mm; max-width: 92%; object-fit: contain; }
  .ttd-nama { font-size: 11.5px; font-weight: 700; text-decoration: underline; }
  .ttd-nip { font-size: 10.5px; }

  .footer-note {
    margin-top: 12px;
    font-size: 9.5px; color: #333; border-top: 1px solid #999; padding-top: 3px;
    display: flex; justify-content: space-between; gap: 10px;
    page-break-inside: avoid;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
`;

const kopHtml = (judul, subtitle) => `
  <div class="kop">
    <img class="logo" src="${LOGO_URL}" alt="Logo Badan POM" />
    <div class="instansi">
      <div class="badan">BADAN POM</div>
      <div class="nama-lengkap">${INSTANSI}</div>
    </div>
    <div class="title">${judul}</div>
    ${subtitle ? `<div class="subtitle-doc">${subtitle}</div>` : ''}
  </div>
`;

const footerNoteHtml = (extra = '') => `
  <div class="footer-note">
    <span>Dicetak otomatis dari ${APP_NAME} - ${new Date().toLocaleString('id-ID')}</span>
    <span>${extra}</span>
  </div>
`;

// ============================================
// DOKUMEN 1: FORMULIR LAPORAN (1 LAPORAN)
// ============================================
const barisTindakLanjut = (laporan) => {
  const dp = laporan.detail_perbaikan || {};
  const steps = [];

  steps.push({
    tahap: 'Pengajuan Laporan',
    pelaksana: laporan.pelapor_nama || laporan.pelapor_id,
    waktu: laporan.tgl_laporan || laporan.created_at,
    catatan: 'Laporan kerusakan diajukan oleh pelapor.',
  });

  if (laporan.verified_by || laporan.verified_at || laporan.verified_catatan) {
    steps.push({
      tahap: 'Cek Fisik / Verifikasi',
      pelaksana: laporan.verified_by,
      waktu: laporan.verified_at,
      catatan: laporan.verified_catatan,
    });
  }

  if (laporan.katim_confirm_by || laporan.katim_nama || laporan.katim_confirm_at) {
    steps.push({
      tahap: 'Diteruskan ke PPK (Katim)',
      pelaksana: laporan.katim_confirm_by || laporan.katim_nama,
      waktu: laporan.katim_confirm_at,
      catatan: laporan.ppk_nama ? `Ditujukan kepada PPK: ${laporan.ppk_nama}` : null,
    });
  }

  if (laporan.ppk_confirm_by || laporan.ppk_nama || laporan.kisaran_biaya) {
    steps.push({
      tahap: 'Verifikasi PPK',
      pelaksana: laporan.ppk_confirm_by || laporan.ppk_nama,
      waktu: laporan.ppk_confirm_at,
      catatan: laporan.kisaran_biaya ? `Kisaran biaya perbaikan: ${fmtRupiah(laporan.kisaran_biaya)}` : null,
    });
  }

  if (laporan.perbaikan_done_by || laporan.perbaikan_done_at || dp.hasil_perbaikan) {
    steps.push({
      tahap: 'Pelaksanaan Perbaikan',
      pelaksana: laporan.perbaikan_done_by,
      waktu: laporan.perbaikan_done_at || dp.tanggal_selesai,
      catatan: dp.hasil_perbaikan
        ? HASIL_PERBAIKAN_LABEL[dp.hasil_perbaikan] || dp.hasil_perbaikan
        : null,
    });
  }

  if (laporan.kabag_confirm_by || laporan.kabag_confirm_at) {
    steps.push({
      tahap: 'Konfirmasi Kabag TU',
      pelaksana: laporan.kabag_confirm_by,
      waktu: laporan.kabag_confirm_at,
      catatan: null,
    });
  }

  if (laporan.user_confirm_by || laporan.user_confirm_at) {
    steps.push({
      tahap: 'Konfirmasi Pelapor (Selesai)',
      pelaksana: laporan.user_confirm_by,
      waktu: laporan.user_confirm_at,
      catatan: 'Pelapor menyatakan perbaikan selesai dan diterima.',
    });
  }

  return steps;
};

const renderFotos = (laporan) => {
  const fotos = fotoUrlsDari(laporan);
  if (fotos.length === 0) {
    return `
      <div class="section-title">IV. DOKUMENTASI FOTO KERUSAKAN</div>
      <p class="note muted">Tidak ada foto kerusakan yang dilampirkan.</p>
    `;
  }
  return `
    <div class="section-title">IV. DOKUMENTASI FOTO KERUSAKAN (${fotos.length} foto)</div>
    <div class="fotos">
      ${fotos
        .map(
          (url, i) => `
        <figure>
          <img src="${escapeHtml(url)}" alt="Foto kerusakan ${i + 1}" />
          <figcaption>Foto ${i + 1}</figcaption>
        </figure>`
        )
        .join('')}
    </div>
  `;
};

const renderDetailPerbaikan = (laporan) => {
  const dp = laporan.detail_perbaikan;
  if (!dp) return '';

  const rows = [
    ['Hasil Perbaikan', dp.hasil_perbaikan ? HASIL_PERBAIKAN_LABEL[dp.hasil_perbaikan] || dp.hasil_perbaikan : null],
    ['Tanggal Selesai', dp.tanggal_selesai ? fmtTanggal(dp.tanggal_selesai) : null],
    ['Vendor / Pelaksana', dp.nama_vendor],
    ['Nomor Kontrak / SPK', dp.no_kontrak],
    ['Biaya Aktual', dp.biaya_aktual ? fmtRupiah(dp.biaya_aktual) : null],
    ['Rating Kualitas', dp.rating ? `${dp.rating} / 5` : null],
    ['Catatan Perbaikan', dp.catatan],
    ['Rekomendasi / Catatan Tambahan', dp.rekomendasi],
  ].filter(([, val]) => !isEmptyValue(val));

  if (rows.length === 0) return '';

  return `
    <div class="section-title">VI. DETAIL PELAKSANAAN PERBAIKAN</div>
    <table>
      <tbody>
        ${rows
          .map(
            ([label, val]) => `
          <tr>
            <td style="width:28%; font-weight:600; background:#fafafa;">${escapeHtml(label)}</td>
            <td>${nl2br(val)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
};

/**
 * Daftar penandatangan pada dokumen (dipakai untuk mencari TTD ke backend).
 * Setiap entri punya `kunci`: kandidat identitas yang dicoba berurutan
 * (user_id/uuid -> nama/NIP), karena tabel laporan menyimpan campuran keduanya.
 */
export const penandatanganLaporan = (laporan) => {
  if (!laporan) return [];
  const picNama = laporan.pic_ruangan_nama || laporan.pic_user_name || null;
  const picId = laporan.pic_ruangan_id || laporan.pic_user_id || null;

  return [
    {
      jabatan: 'Pelapor',
      nama: laporan.pelapor_nama || laporan.pelapor_id,
      kunci: [laporan.pelapor_id, laporan.pelapor_nama],
    },
    {
      jabatan: 'PIC Ruangan / Pengelola',
      nama: picNama,
      kunci: [picId, picNama],
    },
    {
      jabatan: 'Petugas Cek Fisik',
      nama: laporan.verified_by,
      kunci: [laporan.verified_by],
    },
    {
      jabatan: 'Ketua Tim Kerja',
      nama: laporan.katim_nama || laporan.katim_confirm_by,
      kunci: [laporan.katim_id, laporan.katim_confirm_by, laporan.katim_nama],
    },
    {
      jabatan: 'Pejabat Pembuat Komitmen',
      nama: laporan.ppk_nama || laporan.ppk_confirm_by,
      kunci: [laporan.ppk_id, laporan.ppk_confirm_by, laporan.ppk_nama],
    },
    {
      jabatan: 'Kabag Tata Usaha',
      nama: laporan.kabag_confirm_by,
      kunci: [laporan.kabag_confirm_by],
    },
    {
      jabatan: 'Konfirmasi Pelapor',
      nama: laporan.user_confirm_by,
      kunci: [laporan.user_confirm_by],
    },
  ]
    .filter((s) => !isEmptyValue(s.nama))
    .map((s) => ({
      ...s,
      kunci: [...new Set(s.kunci.filter((k) => !isEmptyValue(k)).map((k) => String(k).trim()))],
    }));
};

/** Kunci identitas TTD yang perlu diminta ke backend (gabungan semua penandatangan). */
export const kunciPenandatangan = (laporan) =>
  [...new Set(penandatanganLaporan(laporan).flatMap((s) => s.kunci))];

const normKunci = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

// Peta TTD dari backend: { "<kunci yang diminta>": "<url gambar>" }
const buatIndexTtd = (ttd) => {
  const map = new Map();
  Object.entries(ttd || {}).forEach(([k, v]) => {
    if (v) map.set(normKunci(k), String(v));
  });
  return map;
};

const ttdUntuk = (penandatangan, indexTtd) => {
  if (!indexTtd || indexTtd.size === 0) return null;
  for (const kunci of penandatangan.kunci || []) {
    const url = indexTtd.get(normKunci(kunci));
    if (url) return url;
  }
  return null;
};

const buildSignatures = (laporan, opts = {}) => {
  const daftar = penandatanganLaporan(laporan);
  if (daftar.length === 0) return '';

  const indexTtd = buatIndexTtd(opts.ttd);

  const rows = [];
  for (let i = 0; i < daftar.length; i += 3) {
    rows.push(daftar.slice(i, i + 3));
  }

  const cellHtml = (s) => {
    const url = ttdUntuk(s, indexTtd);
    return `
    <td>
      <div class="ttd-jabatan">${escapeHtml(s.jabatan)}</div>
      ${
        url
          ? `<div class="ttd-ttdbox"><img class="ttd-img" src="${escapeHtml(
              url
            )}" alt="TTD ${escapeHtml(
              s.nama
            )}" onerror="var b=this.parentNode;b.className='ttd-space';b.innerHTML='';" /></div>`
          : '<div class="ttd-space"></div>'
      }
      <div class="ttd-nama">${escapeHtml(s.nama)}</div>
    </td>`;
  };

  return `
    <div class="section-title">VIII. TANDA TANGAN</div>
    <table class="ttd">
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr>
            ${row.map(cellHtml).join('')}
            ${Array.from({ length: Math.max(0, 3 - row.length) })
              .map(() => '<td></td>')
              .join('')}
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    ${
      indexTtd.size > 0
        ? '<p class="muted" style="margin-top:4px;">Tanda tangan elektronik diambil dari profil aplikasi Talawang.</p>'
        : ''
    }
  `;
};

/**
 * Bangun HTML dokumen formulir 1 laporan kerusakan (lengkap).
 * @param {object} laporan - data laporan dari API (hasil mapLaporan)
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.ttd] - peta kunci identitas -> URL gambar TTD
 * @returns {string} HTML dokumen siap cetak
 */
export const buildLaporanRusakHtml = (laporan, opts = {}) => {
  if (!laporan) return '';

  const steps = barisTindakLanjut(laporan);
  const dp = laporan.detail_perbaikan || {};

  const identitas = [
    ['Nomor Laporan', laporan.nomor_laporan],
    ['Tanggal Laporan', laporan.tgl_laporan ? fmtTanggal(laporan.tgl_laporan) : null],
    ['Prioritas', PRIORITAS_LABEL[laporan.prioritas] || laporan.prioritas],
    ['Status', STATUS_LABEL[laporan.status] || laporan.status],
  ];

  const dataAset = [
    ['Nama Barang', laporan.aset_nama],
    ['Kode Barang', laporan.aset_kode],
    ['Merk / Tipe', laporan.aset_merk],
    ['Ruangan', laporan.ruangan_nama || laporan.nama_ruangan],
    ['Kode Ruangan', laporan.ruangan_kode || laporan.kode_ruangan],
    ['Lokasi', laporan.lokasi],
    ['Pelapor', laporan.pelapor_nama || laporan.pelapor_id],
    ['PIC Ruangan', laporan.pic_ruangan_nama || laporan.pic_user_name],
  ];

  const biayaRows = [
    ['Kisaran Biaya (PPK)', laporan.kisaran_biaya ? fmtRupiah(laporan.kisaran_biaya) : null],
    ['Biaya Aktual Perbaikan', dp.biaya_aktual ? fmtRupiah(dp.biaya_aktual) : null],
  ].filter(([, v]) => !isEmptyValue(v));

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Laporan Kerusakan ${escapeHtml(laporan.nomor_laporan || '')}</title>
<style>${baseStyles('portrait')}</style>
</head>
<body>
  <div class="sheet">
    ${kopHtml(
      'FORMULIR LAPORAN KERUSAKAN ASET',
      `Nomor: ${escapeHtml(orDash(laporan.nomor_laporan))} &nbsp;&nbsp;|&nbsp;&nbsp; Status: ${
        STATUS_LABEL[laporan.status] || laporan.status || '-'
      }`
    )}

    <div class="section-title">I. IDENTITAS LAPORAN</div>
    <table class="meta">
      <tbody>
        ${identitas
          .map(
            ([label, val], i, arr) =>
              i % 2 === 0
                ? `<tr>
                     <td class="lbl">${escapeHtml(label)}</td>
                     <td class="val">${nl2br(orDash(val))}</td>
                     ${
                       arr[i + 1]
                         ? `<td class="lbl">${escapeHtml(arr[i + 1][0])}</td><td class="val">${nl2br(
                             orDash(arr[i + 1][1])
                           )}</td>`
                         : '<td class="lbl"></td><td class="val"></td>'
                     }
                   </tr>`
                : ''
          )
          .join('')}
      </tbody>
    </table>

    <div class="section-title">II. DATA ASET &amp; LOKASI</div>
    <table class="meta">
      <tbody>
        ${dataAset
          .map(
            ([label, val], i, arr) =>
              i % 2 === 0
                ? `<tr>
                     <td class="lbl">${escapeHtml(label)}</td>
                     <td class="val">${nl2br(orDash(val))}</td>
                     ${
                       arr[i + 1]
                         ? `<td class="lbl">${escapeHtml(arr[i + 1][0])}</td><td class="val">${nl2br(
                             orDash(arr[i + 1][1])
                           )}</td>`
                         : '<td class="lbl"></td><td class="val"></td>'
                     }
                   </tr>`
                : ''
          )
          .join('')}
      </tbody>
    </table>

    <div class="section-title">III. URAIAN KERUSAKAN</div>
    <table>
      <tbody>
        <tr>
          <td class="note">${laporan.deskripsi ? nl2br(laporan.deskripsi) : '-'}</td>
        </tr>
      </tbody>
    </table>

    ${renderFotos(laporan)}

    <div class="section-title">V. TINDAK LANJUT / ALUR PERSETUJUAN</div>
    <table>
      <thead>
        <tr>
          <th class="center" style="width:5%;">No</th>
          <th style="width:23%;">Tahapan</th>
          <th style="width:22%;">Pelaksana</th>
          <th style="width:20%;">Waktu</th>
          <th>Catatan</th>
        </tr>
      </thead>
      <tbody>
        ${steps
          .map(
            (s, i) => `
          <tr>
            <td class="center">${i + 1}</td>
            <td>${escapeHtml(s.tahap)}</td>
            <td>${nl2br(orDash(s.pelaksana))}</td>
            <td>${escapeHtml(s.waktu ? fmtTanggal(s.waktu) : '-')}</td>
            <td>${s.catatan ? nl2br(s.catatan) : '-'}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    ${renderDetailPerbaikan(laporan)}

    ${
      biayaRows.length
        ? `<div class="section-title">VII. REKAPITULASI BIAYA</div>
    <table>
      <tbody>
        ${biayaRows
          .map(
            ([label, val]) => `
          <tr>
            <td style="width:35%; font-weight:600; background:#fafafa;">${escapeHtml(label)}</td>
            <td>${escapeHtml(val)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`
        : ''
    }

    ${buildSignatures(laporan, opts)}

    ${footerNoteHtml(`Status akhir: ${escapeHtml(STATUS_LABEL[laporan.status] || '-')}`)}
  </div>
</body>
</html>`;

  return html;
};

/**
 * Cetak / simpan PDF satu laporan kerusakan (lengkap).
 * @param {object} laporan - data laporan dari API (hasil mapLaporan)
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.ttd] - peta kunci identitas -> URL gambar TTD
 */
export const cetakLaporanRusak = (laporan, opts = {}) => {
  const ttdAsli = opts.ttd || {};
  const ttdUrls = Object.values(ttdAsli).filter(Boolean);
  const fotos = fotoUrlsDari(laporan);

  // Pastikan TTD benar-benar bisa dimuat; kalau tidak, hilangkan agar tidak
  // muncul ikon gambar rusak di dokumen.
  const lanjut = (ttdValid) => {
    const html = buildLaporanRusakHtml(laporan, { ...opts, ttd: ttdValid });
    if (!html) return;
    openPrintWindow(html, [...fotos, ...Object.values(ttdValid)]);
  };

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

// ============================================
// DOKUMEN 2: REKAPITULASI DAFTAR LAPORAN
// ============================================
const ringkasFilter = (filters = {}) => {
  const bagian = [];
  if (filters.status) bagian.push(`Status: ${STATUS_LABEL[filters.status] || filters.status}`);
  if (filters.prioritas)
    bagian.push(`Prioritas: ${PRIORITAS_LABEL[filters.prioritas] || filters.prioritas}`);
  if (filters.search) bagian.push(`Kata kunci: "${filters.search}"`);
  if (filters.ruangan_id) bagian.push(`Ruangan ID: ${filters.ruangan_id}`);
  if (filters.aset_id) bagian.push(`Aset ID: ${filters.aset_id}`);
  if (filters.pelapor_id) bagian.push(`Pelapor ID: ${filters.pelapor_id}`);
  return bagian.length ? bagian.join(' | ') : 'Semua data (tanpa filter)';
};

/**
 * Bangun HTML dokumen rekapitulasi daftar laporan kerusakan (A4 landscape).
 * @param {object} opts - lihat cetakDaftarLaporanRusak
 * @returns {string} HTML dokumen siap cetak
 */
export const buildDaftarLaporanRusakHtml = ({ data = [], filters = {}, statistics = null } = {}) => {
  const rows = Array.isArray(data) ? data : [];
  const totalBiayaAktual = rows.reduce((acc, r) => {
    const n = parseRupiahNumber(r?.detail_perbaikan?.biaya_aktual);
    return acc + (n === null ? 0 : n);
  }, 0);

  const statusCount = rows.reduce((acc, r) => {
    const s = r.status || 'lainnya';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const statistikHtml = statistics
    ? `<table style="margin-top:5px;">
        <thead>
          <tr>
            <th class="center">Total</th>
            <th class="center">Diajukan</th>
            <th class="center">Menunggu Katim</th>
            <th class="center">Menunggu PPK</th>
            <th class="center">Dalam Perbaikan</th>
            <th class="center">Konfirmasi Kabag</th>
            <th class="center">Konfirmasi User</th>
            <th class="center">Selesai</th>
            <th class="center">Ditolak</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="center">${statistics.total || 0}</td>
            <td class="center">${statistics.diajukan || 0}</td>
            <td class="center">${statistics.menunggu_katim || 0}</td>
            <td class="center">${statistics.menunggu_ppk || 0}</td>
            <td class="center">${statistics.dalam_perbaikan || 0}</td>
            <td class="center">${statistics.menunggu_konfirmasi_kabag || 0}</td>
            <td class="center">${statistics.menunggu_konfirmasi_user || 0}</td>
            <td class="center">${statistics.selesai || 0}</td>
            <td class="center">${statistics.ditolak || 0}</td>
          </tr>
        </tbody>
      </table>`
    : `<table style="margin-top:5px;">
        <thead>
          <tr>
            ${Object.keys(statusCount)
              .map((s) => `<th class="center">${escapeHtml(STATUS_LABEL[s] || s)}</th>`)
              .join('')}
            <th class="center">Jumlah Data Tampil</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            ${Object.values(statusCount)
              .map((v) => `<td class="center">${v}</td>`)
              .join('')}
            <td class="center"><strong>${rows.length}</strong></td>
          </tr>
        </tbody>
      </table>`;

  const ringkasPelaksana = (r) => {
    if (!r) return '-';
    const dp = r.detail_perbaikan || {};
    if (r.perbaikan_done_by) {
      return dp.hasil_perbaikan === 'eksternal'
        ? `${r.perbaikan_done_by} (vendor)`
        : `${r.perbaikan_done_by} (internal)`;
    }
    return r.ppk_confirm_by || r.ppk_nama || r.pic_ruangan_nama || '-';
  };

  const bodyRows = rows
    .map((r, i) => {
      const dp = r.detail_perbaikan || {};
      return `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${escapeHtml(orDash(r.nomor_laporan))}</td>
        <td>${escapeHtml(r.tgl_laporan ? fmtTanggal(r.tgl_laporan) : '-')}</td>
        <td>${escapeHtml(orDash(r.pelapor_nama || r.pelapor_id))}</td>
        <td>${escapeHtml(orDash(r.ruangan_nama || r.nama_ruangan))}</td>
        <td>${escapeHtml(orDash(r.aset_nama))}<br/><span class="muted">${escapeHtml(
        orDash(r.aset_kode)
      )}</span></td>
        <td>${nl2br(orDash(r.deskripsi))}</td>
        <td class="center">${escapeHtml(PRIORITAS_LABEL[r.prioritas] || orDash(r.prioritas))}</td>
        <td class="center">${escapeHtml(STATUS_LABEL[r.status] || orDash(r.status))}</td>
        <td>${escapeHtml(orDash(ringkasPelaksana(r)))}</td>
        <td style="text-align:right;">${escapeHtml(
          dp.biaya_aktual ? fmtRupiah(dp.biaya_aktual) : r.kisaran_biaya ? fmtRupiah(r.kisaran_biaya) : '-'
        )}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Rekapitulasi Laporan Kerusakan Aset</title>
<style>
  ${baseStyles('landscape')}
  table.rekap { font-size: 10.5px; }
  table.rekap th, table.rekap td { padding: 3px 5px; }
</style>
</head>
<body>
  <div class="sheet">
    ${kopHtml(
      'REKAPITULASI LAPORAN KERUSAKAN ASET',
      `Periode cetak: ${escapeHtml(
        new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      )}`
    )}

    <table class="meta no-border" style="margin-top:8px;">
      <tbody>
        <tr>
          <td style="width:14%; font-weight:700;">Filter Aktif</td>
          <td>: ${escapeHtml(ringkasFilter(filters))}</td>
        </tr>
        <tr>
          <td style="font-weight:700;">Jumlah Data</td>
          <td>: ${rows.length} laporan</td>
        </tr>
        ${
          totalBiayaAktual > 0
            ? `<tr>
                 <td style="font-weight:700;">Total Biaya Aktual</td>
                 <td>: ${escapeHtml(fmtRupiah(totalBiayaAktual))}</td>
               </tr>`
            : ''
        }
      </tbody>
    </table>

    <div class="section-title">RINGKASAN STATUS ${
      statistics ? '(SELURUH DATA)' : '(DATA YANG DICETAK)'
    }</div>
    ${statistikHtml}

    <div class="section-title">DAFTAR LAPORAN KERUSAKAN</div>
    ${
      rows.length === 0
        ? '<p class="note muted">Tidak ada data laporan pada filter ini.</p>'
        : `<table class="rekap">
      <thead>
        <tr>
          <th class="center" style="width:3%;">No</th>
          <th style="width:9%;">No. Laporan</th>
          <th style="width:7%;">Tanggal</th>
          <th style="width:9%;">Pelapor</th>
          <th style="width:8%;">Ruangan</th>
          <th style="width:12%;">Aset</th>
          <th style="width:22%;">Deskripsi Kerusakan</th>
          <th class="center" style="width:6%;">Prioritas</th>
          <th style="width:9%;">Status</th>
          <th style="width:9%;">Pelaksana</th>
          <th style="width:8%;">Biaya</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`
    }

    ${footerNoteHtml('Rekapitulasi Laporan Kerusakan Aset')}
  </div>
</body>
</html>`;

  return html;
};

/**
 * Cetak / simpan PDF rekapitulasi laporan kerusakan.
 * @param {object} opts
 * @param {Array}  opts.data - daftar laporan
 * @param {object} [opts.filters] - filter aktif di layar
 * @param {object} [opts.statistics] - statistik status (opsional)
 */
export const cetakDaftarLaporanRusak = (opts = {}) => {
  const html = buildDaftarLaporanRusakHtml(opts);
  if (!html) return;
  openPrintWindow(html, []);
};

export default {
  cetakLaporanRusak,
  cetakDaftarLaporanRusak,
  buildLaporanRusakHtml,
  buildDaftarLaporanRusakHtml,
};
