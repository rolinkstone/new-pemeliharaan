// backend/utils/pdfMerge.js
// Menggabungkan beberapa file (gambar jpg/png atau PDF) menjadi SATU file PDF.
// Dipakai utk "Download Gabungan" nota/kuitansi + foto barang pada Barang Masuk.
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const isPng = (buf) => buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
const isJpeg = (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
const isPdf = (buf) => buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;

// Halaman gambar: skala agar muat di kertas A4 (595 x 842 pt) bila lebih besar
const addImagePage = (doc, img) => {
    const maxW = 595, maxH = 842;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.max(1, img.width * scale);
    const h = Math.max(1, img.height * scale);
    const page = doc.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
};

/**
 * @param {string[]} filePaths — daftar path file (gambar/PDF) di folder uploads
 * @returns {Promise<Buffer>} — buffer PDF gabungan
 */
async function mergeFilesToPdf(filePaths) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (const fp of filePaths) {
        if (!fp || !fs.existsSync(fp)) continue;
        const buf = fs.readFileSync(fp);
        if (buf.length === 0) continue;

        try {
            if (isPdf(buf)) {
                const src = await PDFDocument.load(buf, { ignoreEncryption: true });
                const pages = await doc.copyPages(src, src.getPageIndices());
                pages.forEach((p) => doc.addPage(p));
            } else if (isPng(buf)) {
                addImagePage(doc, await doc.embedPng(buf));
            } else if (isJpeg(buf)) {
                addImagePage(doc, await doc.embedJpg(buf));
            } else {
                // File tidak dikenal: beri halaman penanda saja
                const page = doc.addPage([595, 842]);
                page.drawText(`File tidak dapat digabung: ${path.basename(fp)}`, { x: 50, y: 800, size: 11, font });
            }
        } catch (e) {
            console.error('Gagal memproses file utk merge PDF:', fp, e.message);
            const page = doc.addPage([595, 842]);
            page.drawText(`Gagal memproses file: ${path.basename(fp)} (${e.message})`, { x: 50, y: 800, size: 10, font });
        }
    }

    return Buffer.from(await doc.save());
}

// Ambil nama file aman dari URL (mis. '/uploads/foto-123.jpg' atau 'http://host/uploads/x.jpg')
const safeFileName = (url) => {
    if (!url) return '';
    const noQuery = String(url).split(/[?#]/)[0];
    return path.basename(noQuery).replace(/[\\/]/g, '');
};

module.exports = { mergeFilesToPdf, safeFileName };
