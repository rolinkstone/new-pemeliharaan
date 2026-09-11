// utils/printUtils.js - VERSION 4.1 (Perbaikan TTE dan QR Code)

// ============================================
// IMPORT LIBRARY (jika menggunakan module)
// ============================================

// Pastikan qrcode.js diimpor di file HTML Anda
// <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

// ============================================
// FUNGSI UTAMA
// ============================================

// Fungsi terbilang untuk konversi angka ke kata
export const terbilang = (angka) => {
  if (angka === 0) return 'nol';
  
  const bilangan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  
  const convert = (number) => {
    if (number < 12) {
      return bilangan[number];
    } else if (number < 20) {
      return convert(number - 10) + ' belas';
    } else if (number < 100) {
      return convert(Math.floor(number / 10)) + ' puluh ' + convert(number % 10);
    } else if (number < 200) {
      return 'seratus ' + convert(number - 100);
    } else if (number < 1000) {
      return convert(Math.floor(number / 100)) + ' ratus ' + convert(number % 100);
    } else if (number < 2000) {
      return 'seribu ' + convert(number - 1000);
    } else if (number < 1000000) {
      return convert(Math.floor(number / 1000)) + ' ribu ' + convert(number % 1000);
    } else if (number < 1000000000) {
      return convert(Math.floor(number / 1000000)) + ' juta ' + convert(number % 1000000);
    }
    return 'angka terlalu besar';
  };
  
  return convert(angka).replace(/\s+/g, ' ').trim();
};

// Format Rupiah helper
export const formatRupiah = (number) => {
  if (number === undefined || number === null) return '0';
  return Number(number).toLocaleString('id-ID');
};

// Format Date helper
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

// Format Date range untuk pelaksanaan
export const formatDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return '-';
  
  try {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && end) {
      const startDay = start.getDate();
      const startMonth = start.toLocaleDateString('id-ID', { month: 'long' });
      const startYear = start.getFullYear();
      const endDay = end.getDate();
      const endMonth = end.toLocaleDateString('id-ID', { month: 'long' });
      const endYear = end.getFullYear();
      
      if (startMonth === endMonth && startYear === endYear) {
        return `${startDay} s.d. ${endDay} ${startMonth} ${startYear}`;
      }
      return `${startDay} ${startMonth} ${startYear} s.d. ${endDay} ${endMonth} ${endYear}`;
    } else if (start) {
      const day = start.getDate();
      const month = start.toLocaleDateString('id-ID', { month: 'long' });
      const year = start.getFullYear();
      return `${day} ${month} ${year}`;
    }
    return formatDateForDisplay(startDate) || '-';
  } catch (error) {
    return `${formatDateForDisplay(startDate)} s.d. ${formatDateForDisplay(endDate)}`;
  }
};

// Fungsi untuk menghitung total dari biaya_list
export const calculateTotalFromBiayaList = (biayaList) => {
  let total = 0;
  
  if (biayaList && biayaList.length > 0) {
    biayaList.forEach(biaya => {
      // Hitung transportasi
      if (biaya.transportasi && biaya.transportasi.length > 0) {
        biaya.transportasi.forEach(t => {
          total += Number(t.total) || 0;
        });
      }
      
      // Hitung uang harian
      if (biaya.uang_harian && biaya.uang_harian.length > 0) {
        biaya.uang_harian.forEach(u => {
          total += Number(u.total) || 0;
        });
      }
      
      // Hitung penginapan
      if (biaya.penginapan && biaya.penginapan.length > 0) {
        biaya.penginapan.forEach(p => {
          total += Number(p.total) || 0;
        });
      }
    });
  }
  
  return total;
};

// ============================================
// QRCODE FUNCTIONS (Menggunakan QRCode.js)
// ============================================

// Fungsi untuk generate data TTE untuk QR Code
const generateTTEData = (item, role) => {
  if (!item) return '';
  
  const baseUrl = window.location.origin || 'https://example.com';
  const timestamp = new Date().toISOString();
  
  // Data dasar yang akan disimpan di QR
  const data = {
    id: item.id || '',
    no_st: item.no_st || '',
    kegiatan: item.kegiatan || '',
    mak: item.mak || '',
    status: item.status || '',
    role: role,
    timestamp: timestamp,
    tte: true,
    signature: btoa(`${item.id}-${role}-${timestamp}`).substring(0, 32)
  };
  
  return JSON.stringify(data);
};

// Fungsi untuk generate QR Code sebagai Base64 SVG
const generateQRCodeSVG = (data, options = {}) => {
  // Fallback jika qrcode.js tidak tersedia
  if (typeof QRCode === 'undefined') {
    console.warn('QRCode library not loaded, using fallback');
    return generateFallbackQRCode();
  }
  
  try {
    const qr = new QRCode({
      content: data,
      padding: 0,
      width: options.width || 80,
      height: options.height || 80,
      color: options.color || "#000000",
      background: options.background || "#ffffff",
      ecl: options.ecl || "M" // Error Correction Level: L, M, Q, H
    });
    
    return qr.svg();
  } catch (error) {
    console.error('Error generating QR Code:', error);
    return generateFallbackQRCode();
  }
};

// Fallback QR Code sederhana (jika library tidak tersedia)
const generateFallbackQRCode = () => {
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" fill="white"/>
      <rect x="8" y="8" width="64" height="64" fill="black"/>
      <rect x="24" y="24" width="32" height="32" fill="white"/>
      <rect x="24" y="52" width="16" height="20" fill="black"/>
      <rect x="52" y="24" width="8" height="32" fill="black"/>
    </svg>
  `)}`;
};

// Fungsi untuk mendapatkan QR Code berdasarkan role
const getQRCodeForRole = (item, role) => {
  if (!item) return '';
  
  const data = generateTTEData(item, role);
  const qrOptions = {
    width: 80,
    height: 80,
    color: "#000000",
    background: "#ffffff",
    ecl: "M"
  };
  
  return generateQRCodeSVG(data, qrOptions);
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Fungsi untuk menentukan apakah QRCode harus ditampilkan
const shouldShowQRCode = (item, role) => {
  if (!item || !item.status) return false;
  
  const status = item.status.toLowerCase();
  
  if (role === 'ppk') {
    return status === 'diketahui' || status === 'disetujui' || status === 'selesai';
  } else if (role === 'kabalai') {
    return status === 'disetujui' || status === 'selesai';
  }
  
  return false;
};

// Format tanggal TTE
const formatTTEDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '';
  }
};

// ============================================
// FUNGSI UTAMA PRINT (SINGLE PAGE)
// ============================================

// Fungsi utama untuk handle print (satu halaman) - langsung print
export const handlePrint = (item, pegawaiList = [], formatRupiahFn = formatRupiah, formatDateFn = formatDateForDisplay) => {
  const printWindow = window.open('', '_blank');
  
  // Generate print content satu halaman dengan detail
  const printContent = generateOnePagePrintContentWithDetail(item, pegawaiList, formatRupiahFn, formatDateFn);
  
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Set timeout untuk auto print setelah konten selesai dimuat
  setTimeout(() => {
    try {
      // Generate QR Code setelah window terbuka
      generateQRCodeInWindow(printWindow, item);
      
      printWindow.focus();
      printWindow.print();
      
      // Optional: Tutup window setelah print selesai
      printWindow.onafterprint = function() {
        setTimeout(() => {
          printWindow.close();
        }, 500);
      };
    } catch (error) {
      console.error('Error saat print:', error);
      // Jika auto print gagal, tetap tampilkan window untuk manual print
      printWindow.focus();
    }
  }, 500);
};

// Fungsi untuk generate QR Code di window yang sudah terbuka
const generateQRCodeInWindow = (win, item) => {
  try {
    // Pastikan library QRCode tersedia di window baru
    if (!win.QRCode && window.QRCode) {
      win.QRCode = window.QRCode;
    }
    
    // Generate QR Code untuk PPK
    const ppkQRContainer = win.document.getElementById('qrcode-ppk');
    const kabalaiQRContainer = win.document.getElementById('qrcode-kabalai');
    
    if (ppkQRContainer && shouldShowQRCode(item, 'ppk')) {
      const data = generateTTEData(item, 'ppk');
      if (win.QRCode) {
        new win.QRCode(ppkQRContainer, {
          text: data,
          width: 80,
          height: 80,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }
    
    if (kabalaiQRContainer && shouldShowQRCode(item, 'kabalai')) {
      const data = generateTTEData(item, 'kabalai');
      if (win.QRCode) {
        new win.QRCode(kabalaiQRContainer, {
          text: data,
          width: 80,
          height: 80,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }
  } catch (error) {
    console.warn('Tidak dapat generate QR Code:', error);
  }
};

// Generate HTML content untuk print satu halaman DENGAN DETAIL
export const generateOnePagePrintContentWithDetail = (item, pegawaiList = [], formatRupiahFn, formatDateFn) => {
  // Hitung total keseluruhan
  let totalNominatif = item.total_nominatif || 0;
  let totalPegawai = 0;
  

 

  // Buat array untuk tabel pelaksana SPD
  let pelaksanaRows = '';
  // Buat array untuk tabel rincian biaya
  let rincianBiayaRows = '';
  
  if (pegawaiList && pegawaiList.length > 0) {
    pegawaiList.forEach((pegawai, index) => {
      const totalPegawaiIndividu = Number(pegawai.total_biaya) || 0;
      totalPegawai += totalPegawaiIndividu;
      
      // Hitung subtotal per kategori
      let subtotalTransportasi = 0;
      let subtotalUangHarian = 0;
      let subtotalPenginapan = 0;
      
      if (pegawai.biaya_list && pegawai.biaya_list.length > 0) {
        pegawai.biaya_list.forEach(biaya => {
          // Transportasi
          if (biaya.transportasi && biaya.transportasi.length > 0) {
            biaya.transportasi.forEach(t => {
              subtotalTransportasi += Number(t.total) || 0;
            });
          }
          
          // Uang Harian
          if (biaya.uang_harian && biaya.uang_harian.length > 0) {
            biaya.uang_harian.forEach(u => {
              subtotalUangHarian += Number(u.total) || 0;
            });
          }
          
          // Penginapan
          if (biaya.penginapan && biaya.penginapan.length > 0) {
            biaya.penginapan.forEach(p => {
              subtotalPenginapan += Number(p.total) || 0;
            });
          }
        });
      }
      
      // Row untuk tabel Pelaksana SPD
      pelaksanaRows += `
        <tr>
          <td style="border: 1px solid #000; padding: 4px; text-align: center;">${index + 1}</td>
          <td style="border: 1px solid #000; padding: 4px;">${pegawai.nama || '-'}</td>
          <td style="border: 1px solid #000; padding: 4px;">${pegawai.nip || '-'}</td>
          <td style="border: 1px solid #000; padding: 4px;">${pegawai.jabatan || '-'}</td>
        </tr>
      `;
      
      // Row untuk tabel Rincian Biaya
      rincianBiayaRows += `
        <tr>
          <td style="border: 1px solid #000; padding: 4px; text-align: center;">${index + 1}</td>
          <td style="border: 1px solid #000; padding: 4px;">${pegawai.nama || '-'}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: right;">Rp ${formatRupiahFn(subtotalTransportasi)}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: right;">Rp ${formatRupiahFn(subtotalUangHarian)}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: right;">Rp ${formatRupiahFn(subtotalPenginapan)}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">Rp ${formatRupiahFn(totalPegawaiIndividu)}</td>
        </tr>
      `;
    });
    
    // Tambahkan row total di akhir tabel Rincian Biaya
    rincianBiayaRows += `
      <tr style="background-color: #f0f0f0;">
        <td colspan="2" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">JUMLAH TOTAL</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">Rp ${formatRupiahFn(pegawaiList.reduce((sum, p) => {
          let transport = 0;
          if (p.biaya_list && p.biaya_list.length > 0) {
            p.biaya_list.forEach(b => {
              if (b.transportasi) {
                b.transportasi.forEach(t => transport += Number(t.total) || 0);
              }
            });
          }
          return sum + transport;
        }, 0))}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">Rp ${formatRupiahFn(pegawaiList.reduce((sum, p) => {
          let uangHarian = 0;
          if (p.biaya_list && p.biaya_list.length > 0) {
            p.biaya_list.forEach(b => {
              if (b.uang_harian) {
                b.uang_harian.forEach(u => uangHarian += Number(u.total) || 0);
              }
            });
          }
          return sum + uangHarian;
        }, 0))}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">Rp ${formatRupiahFn(pegawaiList.reduce((sum, p) => {
          let penginapan = 0;
          if (p.biaya_list && p.biaya_list.length > 0) {
            p.biaya_list.forEach(b => {
              if (b.penginapan) {
                b.penginapan.forEach(pg => penginapan += Number(pg.total) || 0);
              }
            });
          }
          return sum + penginapan;
        }, 0))}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">Rp ${formatRupiahFn(totalPegawai)}</td>
      </tr>
    `;
  }
  
  // Gunakan total yang sudah dihitung
  if (totalNominatif === 0) {
    totalNominatif = totalPegawai;
  }
  
  const terbilangText = terbilang(totalNominatif);
  const dateRange = item.rencana_tanggal_pelaksanaan 
    ? (item.rencana_tanggal_pelaksanaan_akhir 
        ? `${formatDateFn(item.rencana_tanggal_pelaksanaan)} - ${formatDateFn(item.rencana_tanggal_pelaksanaan_akhir)}`
        : formatDateFn(item.rencana_tanggal_pelaksanaan))
    : '-';
  
  // Tentukan apakah QRCode harus ditampilkan
  const showQrPpk = shouldShowQRCode(item, 'ppk');
  const showQrKabalai = shouldShowQRCode(item, 'kabalai');

  // ============================================
  // RETURN HTML CONTENT
  // ============================================

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Nominatif - ${item.kegiatan || 'Kegiatan'}</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <!-- Load QRCode.js Library -->
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <style>
        /* RESET DAN GLOBAL STYLES */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        @page {
          size: A4;
          margin: 15mm;
        }
        
        body {
          font-family: 'Times New Roman', serif;
          font-size: 11pt;
          line-height: 1.3;
          color: #000;
          width: 100%;
          background: white;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        /* PRINT CONTAINER */
        .print-container {
          max-width: 100%;
          padding: 5mm;
        }
        
        /* HEADER */
        .header {
          text-align: center;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 2px solid #000;
        }
        
        .header h1 {
          font-size: 14pt;
          font-weight: bold;
          margin-bottom: 3px;
          text-transform: uppercase;
        }
        
        .header h2 {
          font-size: 12pt;
          font-weight: normal;
          margin-bottom: 2px;
        }
        
        .header p {
          font-size: 10pt;
          margin: 1px 0;
        }
        
        /* INFO SECTION */
        .info-section {
          margin-bottom: 10px;
        }
        
        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
          font-size: 10pt;
          table-layout: fixed;
        }
        
        .info-table th {
          border: 1px solid #000;
          padding: 5px 6px;
          background-color: #f0f0f0;
          font-weight: bold;
          text-align: center;
          vertical-align: middle;
        }
        
        .info-table td {
          border: 1px solid #000;
          padding: 5px 6px;
          vertical-align: top;
        }
        
        .info-table tr td:first-child,
        .info-table tr th:first-child {
          width: 5% !important;
          text-align: center;
          font-weight: bold;
        }
        
        .info-table tr td:nth-child(2),
        .info-table tr th:nth-child(2) {
          width: 40% !important;
        }
        
        .info-table tr td:nth-child(3),
        .info-table tr th:nth-child(3) {
          width: 55% !important;
        }
        
        /* SECTION TITLE */
        .section-title {
          font-weight: bold;
          font-size: 11pt;
          margin: 15px 0 8px 0;
          padding-bottom: 3px;
          border-bottom: 1px solid #000;
        }
        
        /* DETAIL TABLES */
        .detail-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          font-size: 10pt;
        }
        
        .detail-table th {
          border: 1px solid #000;
          padding: 6px 8px;
          background-color: #f0f0f0;
          font-weight: bold;
          text-align: center;
          vertical-align: middle;
        }
        
        .detail-table td {
          border: 1px solid #000;
          padding: 5px 6px;
          vertical-align: middle;
        }
        
        /* TOTAL BOX */
        .total-box {
          border: 2px solid #000;
          padding: 10px;
          margin: 15px 0;
          text-align: center;
          background-color: #f9f9f9;
          page-break-inside: avoid;
        }
        
        .total-box h3 {
          font-size: 11pt;
          margin-bottom: 5px;
        }
        
        .total-amount {
          font-size: 14pt;
          font-weight: bold;
          color: #006400;
          margin: 5px 0;
        }
        
        .terbilang {
          font-style: italic;
          font-size: 10pt;
          margin: 3px 0;
        }
        
        /* SIGNATURE SECTION - TANPA GARIS TTE */
        .signature-section {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          page-break-inside: avoid;
        }
        
        .signature-box {
          text-align: center;
          width: 32%;
          position: relative;
          padding: 5px;
          min-height: 160px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        
        .signature-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 140px;
          justify-content: flex-end;
        }
        
        /* QRCODE STYLES - DIKECILKAN */
        .qrcode-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 5px 0;
          min-height: 90px;
          page-break-inside: avoid;
        }
        
        .qrcode-wrapper {
          width: 80px !important;
          height: 80px !important;
          background: white !important;
          margin-bottom: 5px;
          display: flex !important;
          align-items: center;
          justify-content: center;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
          border: none !important; /* Hapus border QR Code */
        }
        
        .qrcode-label {
          font-size: 8pt;
          color: #333;
          text-align: center;
          max-width: 100px;
          line-height: 1.2;
          padding: 2px;
          margin-top: 3px;
        }
        
        .qrcode-placeholder {
          width: 80px;
          height: 80px;
          background: #f9f9f9;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #666;
          font-size: 8pt;
          text-align: center;
          margin-bottom: 5px;
          border-radius: 4px;
          padding: 5px;
          border: 1px dashed #ccc; /* Border tipis untuk placeholder */
        }
        
        /* HAPUS GARIS TTE - TIDAK ADA LAGI GARIS BORDER PADA SIGNATURE */
        .signature-line {
          margin-top: 8px;
          padding-top: 3px;
          width: 100%;
          min-width: 150px;
          border: none !important; /* HAPUS SEMUA GARIS */
        }
        
        .signature-name {
          font-weight: bold;
          margin-top: 8px;
          font-size: 10pt;
        }
        
        .signature-nip {
          font-size: 9pt;
          margin-top: 2px;
          color: #333;
        }
        
        .signature-info {
          font-size: 7pt;
          color: #666;
          margin-top: 3px;
          font-style: italic;
          line-height: 1.2;
          text-align: center;
        }
        
        /* HAPUS TTE STAMP - TIDAK PERLU LAGI */
        .tte-stamp {
          display: none !important;
        }
        
        /* Untuk kolom tengah (kosong) */
        .signature-box:nth-child(2) .signature-content {
          justify-content: flex-start;
        }
        
        /* UTILITY CLASSES */
        .center {
          text-align: center;
        }
        
        .bold {
          font-weight: bold;
        }
        
        .text-right {
          text-align: right;
        }
        
        .text-left {
          text-align: left;
        }
        
        .mt-1 { margin-top: 4px; }
        .mt-2 { margin-top: 8px; }
        .mb-1 { margin-bottom: 4px; }
        .mb-2 { margin-bottom: 8px; }
        
        /* PRINT CONTROLS */
        @media screen {
          .print-controls {
            display: block;
            text-align: center;
            margin: 20px auto;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 6px;
            max-width: 400px;
          }
          
          .print-btn {
            margin: 0 8px;
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
          }
          
          .close-btn {
            background: #f44336;
          }
        }
        
        @media print {
          .print-controls {
            display: none !important;
          }
          
          /* FORCE PRINT COLORS AND IMAGES */
          body {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .qrcode-wrapper {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 80px !important;
            height: 80px !important;
          }
          
          .qrcode-container {
            display: block !important;
            page-break-inside: avoid !important;
          }
          
          /* Hide screen-only elements */
          .screen-only {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        <!-- HEADER -->
        <div class="header">
          <h1>DAFTAR RENCANA PERJALANAN DINAS JABATAN</h1>
          <p><strong>No. ST:</strong> ${item.no_st || '-'} | <strong>Tanggal ST:</strong> ${formatDateFn(item.tgl_st) || '-'}</p>
          <p><strong>Status Dokumen:</strong> ${item.status ? item.status.toUpperCase() : 'DRAFT'}</p>
          <p class="screen-only"><strong>Petunjuk:</strong> Preview akan otomatis dicetak. Gunakan Ctrl+P jika tidak otomatis.</p>
        </div>
        
        <!-- INFORMASI UMUM -->
         <div class="section-title">A. Tujuan Perjalanan Dinas</div>
        <div class="info-section">
          <table class="info-table">
            <tr>
              <td class="center">1</td>
              <td>Kegiatan yang akan dilaksanakan</td>
              <td>${item.kegiatan || '-'}</td>
            </tr>
            <tr>
              <td class="center">2</td>
              <td>MAK</td>
              <td>${item.mak || '-'}</td>
            </tr>
            <tr>
              <td class="center">3</td>
              <td>Realisasi anggaran sebelumnya</td>
              <td>${item.realisasi_anggaran_sebelumnya || '-'}</td>
            </tr>
            <tr>
              <td class="center">4</td>
              <td>Target output 1 tahun</td>
              <td>${item.target_output_tahun || '-'}</td>
            </tr>
            <tr>
              <td class="center">5</td>
              <td>Realisasi output sebelumnya</td>
              <td>${item.realisasi_output_sebelumnya || '-'}</td>
            </tr>
            <tr>
              <td class="center">6</td>
              <td>Target output yang akan dicapai</td>
              <td>${item.target_output_yg_akan_dicapai || '-'}</td>
            </tr>
            <tr>
              <td class="center">7</td>
              <td>Kota/Kabupaten/Kecamatan tujuan</td>
              <td>${item.kota_kab_kecamatan || '-'}</td>
            </tr>
            <tr>
              <td class="center">8</td>
              <td>Rencana tanggal pelaksanaan</td>
              <td>${dateRange}</td>
            </tr>
          </table>
        </div>
        
        <!-- B. Pelaksana SPD -->
        <div class="section-title">B. Pelaksana SPD</div>
        <table class="detail-table">
          <thead>
            <tr>
              <th width="5%">No</th>
              <th width="35%">Nama</th>
              <th width="25%">NIP</th>
              <th width="35%">Jabatan</th>
            </tr>
          </thead>
          <tbody>
            ${pelaksanaRows || `
              <tr>
                <td colspan="4" style="text-align: center; padding: 15px; font-style: italic;">
                  Tidak ada data pelaksana
                </td>
              </tr>
            `}
          </tbody>
        </table>
        
        <!-- C. RINCIAN BIAYA -->
        <div class="section-title">C. Rincian Biaya</div>
        <table class="detail-table">
          <thead>
            <tr>
              <th width="5%">No</th>
              <th width="25%">Nama</th>
              <th width="15%">Transport</th>
              <th width="15%">Uang Harian</th>
              <th width="15%">Penginapan</th>
              <th width="15%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rincianBiayaRows || `
              <tr>
                <td colspan="6" style="text-align: center; padding: 15px; font-style: italic;">
                  Tidak ada data rincian biaya
                </td>
              </tr>
            `}
          </tbody>
        </table>
        
        <!-- E. SIGNATURE SECTION TANPA GARIS TTE DAN QRCODE KECIL -->
        <div class="signature-section">
          <!-- Bagian Kabalai (Kiri: Menyetujui) -->
          <div class="signature-box">
            <div class="signature-content">
              <div style="font-size: 10pt; margin-bottom: 3px;"><strong>Menyetujui</strong></div>
              <div style="font-size: 9pt; margin-bottom: 5px;"><strong>Kepala BBPOM di Palangka Raya</strong></div>
              
              <div class="qrcode-container">
                ${showQrKabalai ? `
                  <!-- QRCode Kabalai Container -->
                  <div id="qrcode-kabalai" class="qrcode-wrapper"></div>
                 
                ` : `
                  <div class="qrcode-placeholder">
                    TTD<br>BASAH
                  </div>
                  <div class="qrcode-label">
                    Tanda Tangan Basah
                  </div>
                `}
              </div>
              
              <div class="signature-name">${item.diketahui_oleh || item.namaKabalai || '____________________'}</div>
              
              
            </div>
          </div>
          
          <!-- Bagian Kosong (Tengah) -->
          <div class="signature-box">
            <div class="signature-content">
              <div style="height: 20px;"></div>
              <div class="signature-name">&nbsp;</div>
              <div class="signature-nip">&nbsp;</div>
            </div>
          </div>
          
          <!-- Bagian PPK (Kanan: Mengetahui) -->
          <div class="signature-box">
            <div class="signature-content">
              <div style="font-size: 10pt; margin-bottom: 3px;"><strong>Mengetahui,</strong></div>
              <div style="font-size: 10pt; margin-bottom: 5px;"><strong>Pejabat Pembuat Komitmen</strong></div>
              
              <div class="qrcode-container">
                ${showQrPpk ? `
                  <!-- QRCode PPK Container -->
                  <div id="qrcode-ppk" class="qrcode-wrapper"></div>
                 
                ` : `
                  <div class="qrcode-placeholder">
                    TTD<br>BASAH
                  </div>
                  <div class="qrcode-label">
                    Tanda Tangan Basah
                  </div>
                `}
              </div>
              
              <div class="signature-name">${item.ppk_nama || item.nama_ppk || '____________________'}</div>
            
            </div>
          </div>
        </div>
        
       
      </div>
      
      <script>
        // Fungsi untuk generate QR Code
        function generateQRCode() {
          try {
            const itemData = ${JSON.stringify(item || {})};
            
            // Generate data untuk QR
            function generateTTEData(item, role) {
              if (!item) return '';
              
              const baseUrl = window.location.origin || 'https://example.com';
              const timestamp = new Date().toISOString();
              
              const data = {
                id: item.id || '',
                no_st: item.no_st || '',
                kegiatan: item.kegiatan || '',
                mak: item.mak || '',
                status: item.status || '',
                role: role,
                timestamp: timestamp,
                tte: true,
                signature: btoa(\`\${item.id}-\${role}-\${timestamp}\`).substring(0, 32)
              };
              
              return JSON.stringify(data);
            }
            
            // Generate QR untuk PPK jika dibutuhkan
            const ppkContainer = document.getElementById('qrcode-ppk');
            if (ppkContainer && ${showQrPpk}) {
              const data = generateTTEData(itemData, 'ppk');
              new QRCode(ppkContainer, {
                text: data,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
              });
            }
            
            // Generate QR untuk Kabalai jika dibutuhkan
            const kabalaiContainer = document.getElementById('qrcode-kabalai');
            if (kabalaiContainer && ${showQrKabalai}) {
              const data = generateTTEData(itemData, 'kabalai');
              new QRCode(kabalaiContainer, {
                text: data,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
              });
            }
            
            console.log('QR Code generated successfully');
          } catch (error) {
            console.error('Error generating QR Code:', error);
          }
        }
        
        // Tunggu DOM dan library siap
        document.addEventListener('DOMContentLoaded', function() {
          // Tunggu sedikit untuk memastikan library QRCode sudah dimuat
          setTimeout(() => {
            if (typeof QRCode !== 'undefined') {
              generateQRCode();
            } else {
              console.warn('QRCode library not loaded, retrying...');
              setTimeout(generateQRCode, 500);
            }
          }, 100);
        });
        
        // Auto print setelah QR Code digenerate
        setTimeout(() => {
          try {
            window.print();
            
            window.onafterprint = function() {
              setTimeout(() => {
                window.close();
              }, 1000);
            };
          } catch (error) {
            console.log('Auto print gagal, gunakan tombol manual');
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;
};

// ============================================
// FUNGSI TAMBAHAN
// ============================================

// Fungsi untuk print dengan preview (tanpa auto print)
export const handlePrintWithPreview = (item, pegawaiList = [], formatRupiahFn = formatRupiah, formatDateFn = formatDateForDisplay) => {
  const printWindow = window.open('', '_blank');
  
  // Generate content tanpa auto print
  let printContent = generateOnePagePrintContentWithDetail(item, pegawaiList, formatRupiahFn, formatDateFn);
  
  printWindow.document.write(printContent);
  printWindow.document.close();
};

// Fungsi untuk print detail (versi lama)
export const handlePrintWithDetail = (item, detailData, formatRupiahFn = formatRupiah, formatDateFn = formatDateForDisplay) => {
  const printWindow = window.open('', '_blank');
  
  const pegawaiList = detailData?.[item.id]?.pegawai || [];
  const printContent = generateOnePagePrintContentWithDetail(item, pegawaiList, formatRupiahFn, formatDateFn);
  
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
};

// Versi ringkas tanpa detail
export const generateOnePagePrintContent = (item, pegawaiList = [], formatRupiahFn, formatDateFn) => {
  let totalNominatif = item.total_nominatif || 0;
  
  if (totalNominatif === 0 && pegawaiList && pegawaiList.length > 0) {
    pegawaiList.forEach(pegawai => {
      totalNominatif += Number(pegawai.total_biaya) || 0;
    });
  }
  
  const terbilangText = terbilang(totalNominatif);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Nominatif - ${item.kegiatan || 'Kegiatan'}</title>
      <meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Times New Roman'; font-size: 11pt; }
        .header { text-align: center; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #000; padding: 6px; }
        th { background: #f0f0f0; }
        .total { border: 2px solid #000; padding: 10px; text-align: center; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>NOMINATIF KEGIATAN</h1>
        <h2>${item.kegiatan || '-'}</h2>
      </div>
      
      <table>
        <tr><th>Informasi</th><th>Detail</th></tr>
        <tr><td>Kegiatan</td><td>${item.kegiatan || '-'}</td></tr>
        <tr><td>MAK</td><td>${item.mak || '-'}</td></tr>
        <tr><td>No. ST</td><td>${item.no_st || '-'}</td></tr>
        <tr><td>Tanggal Pelaksanaan</td><td>${formatDateFn(item.rencana_tanggal_pelaksanaan) || '-'}</td></tr>
        <tr><td>Lokasi</td><td>${item.kota_kab_kecamatan || '-'}</td></tr>
      </table>
      
      <div class="total">
        <h2>TOTAL NOMINATIF</h2>
        <h1>Rp ${formatRupiahFn(totalNominatif)}</h1>
        <p><em>${terbilangText} Rupiah</em></p>
      </div>
    </body>
    </html>
  `;
};

// Generate content untuk preview
export const generatePreviewContent = (item, pegawaiList = [], formatRupiahFn, formatDateFn) => {
  let content = generateOnePagePrintContentWithDetail(item, pegawaiList, formatRupiahFn, formatDateFn);
  return content;
};

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  handlePrint,
  handlePrintWithPreview,
  handlePrintWithDetail,
  generateOnePagePrintContentWithDetail,
  generateOnePagePrintContent,
  generatePreviewContent,
  terbilang,
  formatRupiah,
  formatDateForDisplay,
  formatDateRange,
  calculateTotalFromBiayaList
};