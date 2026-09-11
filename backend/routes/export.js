const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ========== EXPORT KE EXCEL - REKAP BULANAN ==========
router.get('/excel/rekap-bulanan', keycloakAuth, async (req, res) => {
    try {
        const { bulan, tahun } = req.query;
        const bulanTarget = bulan || new Date().getMonth() + 1;
        const tahunTarget = tahun || new Date().getFullYear();

        // Ambil data laporan bulan ini
        const [laporan] = await db.query(`
            SELECT 
                lr.nomor_laporan,
                lr.tgl_laporan,
                ma.nama_barang,
                ma.kode_barang,
                r.nama_ruangan,
                lr.deskripsi,
                lr.prioritas,
                lr.status,
                vpk.estimasi_biaya,
                CASE 
                    WHEN pi.id IS NOT NULL THEN 'Internal'
                    WHEN pe.id IS NOT NULL THEN 'Eksternal'
                    ELSE '-'
                END as jenis_perbaikan,
                DATEDIFF(COALESCE(pi.tgl_selesai, pe.tgl_selesai, NOW()), lr.tgl_laporan) as lama_proses
            FROM laporan_rusak lr
            JOIN master_aset ma ON lr.aset_id = ma.id
            JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN verifikasi_ppk vpk ON lr.id = vpk.laporan_id
            LEFT JOIN perbaikan_internal pi ON lr.id = pi.laporan_id
            LEFT JOIN perbaikan_eksternal pe ON lr.id = pe.laporan_id
            WHERE MONTH(lr.tgl_laporan) = ? AND YEAR(lr.tgl_laporan) = ?
            ORDER BY lr.tgl_laporan DESC
        `, [bulanTarget, tahunTarget]);

        // Buat workbook Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Pemeliharaan');

        // Header
        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Nomor Laporan', key: 'nomor_laporan', width: 20 },
            { header: 'Tanggal', key: 'tgl_laporan', width: 15 },
            { header: 'Nama Barang', key: 'nama_barang', width: 30 },
            { header: 'Kode Barang', key: 'kode_barang', width: 15 },
            { header: 'Ruangan', key: 'ruangan', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 40 },
            { header: 'Prioritas', key: 'prioritas', width: 10 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Estimasi Biaya', key: 'estimasi', width: 15 },
            { header: 'Jenis Perbaikan', key: 'jenis', width: 15 },
            { header: 'Lama Proses (hari)', key: 'lama', width: 15 }
        ];

        // Data rows
        laporan.forEach((item, index) => {
            worksheet.addRow({
                no: index + 1,
                nomor_laporan: item.nomor_laporan,
                tgl_laporan: item.tgl_laporan,
                nama_barang: item.nama_barang,
                kode_barang: item.kode_barang,
                ruangan: item.nama_ruangan,
                deskripsi: item.deskripsi,
                prioritas: item.prioritas,
                status: item.status,
                estimasi: item.estimasi_biaya ? `Rp ${item.estimasi_biaya.toLocaleString()}` : '-',
                jenis: item.jenis_perbaikan,
                lama: item.lama_proses
            });
        });

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap_pemeliharaan_${bulanTarget}_${tahunTarget}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting excel:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== EXPORT KE PDF - DETAIL LAPORAN ==========
router.get('/pdf/laporan/:laporanId', keycloakAuth, async (req, res) => {
    try {
        const { laporanId } = req.params;

        // Ambil data lengkap laporan
        const [laporan] = await db.query(`
            SELECT 
                lr.*,
                ma.nama_barang, ma.kode_barang, ma.nup, ma.jenis_bmn, ma.merk, ma.tipe,
                r.nama_ruangan,
                vp.hasil_verifikasi as verifikasi_pic,
                vpk.hasil_verifikasi as verifikasi_ppk, vpk.estimasi_biaya,
                d.tujuan as disposisi_tujuan,
                pi.teknisi_id, pi.tindakan, pi.hasil as hasil_internal,
                pe.pihak_ketiga_id, pe.no_kontrak, pe.biaya, pe.hasil as hasil_eksternal,
                pk3.nama_perusahaan
            FROM laporan_rusak lr
            JOIN master_aset ma ON lr.aset_id = ma.id
            JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN verifikasi_pic_ruangan vp ON lr.id = vp.laporan_id
            LEFT JOIN verifikasi_ppk vpk ON lr.id = vpk.laporan_id
            LEFT JOIN disposisi d ON lr.id = d.laporan_id
            LEFT JOIN perbaikan_internal pi ON lr.id = pi.laporan_id
            LEFT JOIN perbaikan_eksternal pe ON lr.id = pe.laporan_id
            LEFT JOIN pihak_ketiga pk3 ON pe.pihak_ketiga_id = pk3.id
            WHERE lr.id = ?
        `, [laporanId]);

        if (laporan.length === 0) {
            return res.status(404).json({ success: false, message: 'Laporan not found' });
        }

        const data = laporan[0];

        // Buat PDF
        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan_${data.nomor_laporan}.pdf`);
        
        doc.pipe(res);

        // Header
        doc.fontSize(16).text('LAPORAN PEMELIHARAAN ASET', { align: 'center' });
        doc.fontSize(12).text('BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA', { align: 'center' });
        doc.moveDown();
        doc.text(`Nomor Laporan: ${data.nomor_laporan}`, { align: 'right' });
        doc.text(`Tanggal: ${new Date(data.tgl_laporan).toLocaleDateString('id-ID')}`, { align: 'right' });
        doc.moveDown();

        // Info Aset
        doc.fontSize(14).text('A. INFORMASI ASET', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Nama Barang: ${data.nama_barang}`);
        doc.text(`Kode Barang: ${data.kode_barang} / NUP: ${data.nup}`);
        doc.text(`Jenis BMN: ${data.jenis_bmn}`);
        doc.text(`Merk/Tipe: ${data.merk || '-'} / ${data.tipe || '-'}`);
        doc.text(`Lokasi: ${data.nama_ruangan}`);
        doc.moveDown();

        // Info Laporan
        doc.fontSize(14).text('B. DETAIL KERUSAKAN', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Deskripsi: ${data.deskripsi}`);
        doc.text(`Prioritas: ${data.prioritas.toUpperCase()}`);
        doc.moveDown();

        // Verifikasi
        doc.fontSize(14).text('C. VERIFIKASI', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Verifikasi PIC: ${data.verifikasi_pic || 'Belum'}`);
        doc.text(`Verifikasi PPK: ${data.verifikasi_ppk || 'Belum'}`);
        if (data.estimasi_biaya) {
            doc.text(`Estimasi Biaya: Rp ${data.estimasi_biaya.toLocaleString()}`);
        }
        doc.moveDown();

        // Perbaikan
        if (data.disposisi_tujuan) {
            doc.fontSize(14).text('D. PERBAIKAN', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`Jenis Perbaikan: ${data.disposisi_tujuan === 'tim_internal' ? 'Internal' : 'Eksternal'}`);
            
            if (data.disposisi_tujuan === 'tim_internal' && data.hasil_internal) {
                doc.text(`Hasil: ${data.hasil_internal}`);
                doc.text(`Tindakan: ${data.tindakan || '-'}`);
            } else if (data.disposisi_tujuan === 'pihak_ketiga') {
                doc.text(`Vendor: ${data.nama_perusahaan || '-'}`);
                doc.text(`No Kontrak: ${data.no_kontrak || '-'}`);
                doc.text(`Biaya: Rp ${data.biaya?.toLocaleString() || '0'}`);
                doc.text(`Hasil: ${data.hasil_eksternal || '-'}`);
            }
        }

        // Footer
        doc.moveDown(2);
        doc.text(`Dokumen ini dicetak pada: ${new Date().toLocaleString('id-ID')}`, { align: 'center', fontSize: 10 });

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;