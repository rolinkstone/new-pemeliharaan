const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');
const { getUsernameFromToken, decodeToken, getUserRolesFromRequest, hasRole } = require('../utils/routeHelpers');
const { XLSX, normalizeStr, parseExcelDate, todayLocalStr, looksLikeNote, readRowsWithAliases } = require('../utils/xlsxImport');
const { buildXlsxSheet, sendWorkbook, formatDateCell, todayFileStamp } = require('../utils/xlsxExport');

// ========== GET ALL ASET ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM master_aset ORDER BY id DESC');
        
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Error fetching aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== TEMPLATE IMPORT BARANG BMN (XLSX) - endpoint publik ==========

// GET /api/aset/import/template - download template import
router.get('/import/template', async (req, res) => {
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        // Referensi dari DB (best-effort)
        let asetRef = [];
        let jenisList = [];
        let kondisiList = [];
        let statusList = [];
        let intraList = [];
        try {
            const [a] = await db.query(`
                SELECT kode_barang, nup, nama_barang, jenis_bmn, kondisi, status_bmn
                FROM master_aset
                ORDER BY kode_barang ASC, nup ASC
                LIMIT 2000
            `);
            asetRef = a || [];
        } catch (e) { console.error('Template aset ref error:', e.message); }
        try {
            const [j] = await db.query('SELECT DISTINCT jenis_bmn AS v FROM master_aset WHERE jenis_bmn IS NOT NULL AND jenis_bmn != "" ORDER BY jenis_bmn');
            const [k] = await db.query('SELECT DISTINCT kondisi AS v FROM master_aset WHERE kondisi IS NOT NULL AND kondisi != "" ORDER BY kondisi');
            const [s] = await db.query('SELECT DISTINCT status_bmn AS v FROM master_aset WHERE status_bmn IS NOT NULL AND status_bmn != "" ORDER BY status_bmn');
            const [i] = await db.query('SELECT DISTINCT intra_extra AS v FROM master_aset WHERE intra_extra IS NOT NULL AND intra_extra != "" ORDER BY intra_extra');
            jenisList = (j || []).map(r => r.v);
            kondisiList = (k || []).map(r => r.v);
            statusList = (s || []).map(r => r.v);
            intraList = (i || []).map(r => r.v);
        } catch (e) { console.error('Template aset options error:', e.message); }

        const wb = XLSX.utils.book_new();

        // Sheet 1: Template Import (header saja)
        const header = [
            'jenis_bmn', 'nama_satker', 'kode_barang', 'nup', 'nama_barang',
            'status_bmn', 'merk', 'tipe', 'kondisi', 'intra_extra', 'tanggal_perolehan',
        ];
        const ws = XLSX.utils.aoa_to_sheet([header]);
        ws['!cols'] = [
            { wch: 20 }, { wch: 40 }, { wch: 22 }, { wch: 8 }, { wch: 36 },
            { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import');

        // Sheet 2: Petunjuk
        const petunjuk = [
            ['PETUNJUK IMPORT BARANG MILIK NEGARA (BMN)'],
            [''],
            ['1. Isi data pada sheet "Template Import" mulai baris ke-2 (jangan ubah baris header).'],
            ['2. Kolom wajib: jenis_bmn, kode_barang, dan nama_barang.'],
            ['3. Kolom opsional: nama_satker, nup, status_bmn, merk, tipe, kondisi, intra_extra.'],
            ['4. Kolom tanggal_perolehan opsional, format YYYY-MM-DD.'],
            ['5. Nilai default bila kosong: status_bmn = Aktif, kondisi = Baik, intra_extra = Intra.'],
            ['6. Kombinasi kode_barang + nup yang sudah ada akan DILEWATI dan dicatat sebagai gagal.'],
            ['7. Lihat sheet "Referensi Pilihan" untuk nilai jenis_bmn/kondisi/status yang tersedia.'],
            [''],
            ['Contoh pengisian:'],
            ['jenis_bmn', 'nama_satker', 'kode_barang', 'nup', 'nama_barang', 'status_bmn', 'merk', 'tipe', 'kondisi', 'intra_extra', 'tanggal_perolehan'],
            ['Komputer', 'BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA', '1010102001001', '1', 'Laptop ASUS', 'Aktif', 'ASUS', 'X441', 'Baik', 'Intra', '2024-01-15'],
        ];
        const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
        wsPetunjuk['!cols'] = [
            { wch: 20 }, { wch: 50 }, { wch: 22 }, { wch: 8 }, { wch: 36 },
            { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

        // Sheet 3: Referensi Aset (data yang sudah ada)
        if (asetRef.length > 0) {
            const aoa = [['kode_barang', 'nup', 'nama_barang', 'jenis_bmn', 'kondisi', 'status_bmn']];
            asetRef.forEach(a => aoa.push([
                normalizeStr(a.kode_barang), normalizeStr(a.nup), normalizeStr(a.nama_barang),
                normalizeStr(a.jenis_bmn), normalizeStr(a.kondisi), normalizeStr(a.status_bmn),
            ]));
            const wsRef = XLSX.utils.aoa_to_sheet(aoa);
            wsRef['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 36 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];
            XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi Aset');
        }

        // Sheet 4: Referensi Pilihan
        const maxLen = Math.max(jenisList.length, kondisiList.length, statusList.length, intraList.length);
        if (maxLen > 0) {
            const aoa = [['jenis_bmn', 'kondisi', 'status_bmn', 'intra_extra']];
            for (let i = 0; i < maxLen; i++) {
                aoa.push([jenisList[i] || '', kondisiList[i] || '', statusList[i] || '', intraList[i] || '']);
            }
            const wsOpt = XLSX.utils.aoa_to_sheet(aoa);
            wsOpt['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
            XLSX.utils.book_append_sheet(wb, wsOpt, 'Referensi Pilihan');
        }

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template_import_barang_bmn.xlsx');
        res.send(buf);
    } catch (error) {
        console.error('Error generate template import aset:', error);
        res.status(500).json({ success: false, message: 'Gagal generate template', error: error.message });
    }
});

// POST /api/aset/import - import Barang BMN dari file XLSX
router.post('/import', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengimport barang.'
        });
    }

    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        const { fileBase64 } = req.body;
        if (!fileBase64) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });

        const buf = Buffer.from(fileBase64, 'base64');
        const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const sheetName = wb.SheetNames.includes('Template Import') ? 'Template Import' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Kolom boleh memakai nama template (snake_case) ATAU label hasil Export
        const ALIAS = {
            jenis_bmn: ['jenis_bmn', 'Jenis BMN', 'Jenis'],
            nama_satker: ['nama_satker', 'Nama Satker', 'Satker'],
            kode_barang: ['kode_barang', 'Kode Barang'],
            nup: ['nup', 'NUP'],
            nama_barang: ['nama_barang', 'Nama Barang'],
            status_bmn: ['status_bmn', 'Status BMN', 'Status'],
            merk: ['merk', 'Merk'],
            tipe: ['tipe', 'Tipe'],
            kondisi: ['kondisi', 'Kondisi'],
            intra_extra: ['intra_extra', 'Intra/Ekstra', 'Intra Ekstra', 'Intra'],
            tanggal_perolehan: ['tanggal_perolehan', 'Tanggal Perolehan', 'Tgl Perolehan'],
        };
        const { rows, matched } = readRowsWithAliases(ws, ALIAS);

        if (!matched.includes('jenis_bmn') || !matched.includes('kode_barang') || !matched.includes('nama_barang')) {
            return res.status(400).json({
                success: false,
                message: 'Format header tidak dikenali. Gunakan template import atau file hasil Export dari aplikasi.',
                data: {
                    success: 0,
                    failed: 0,
                    errors: ['Kolom wajib tidak ditemukan: jenis_bmn, kode_barang, nama_barang.'],
                },
            });
        }
        if (!rows || rows.length === 0) {
            return res.status(400).json({ success: false, message: 'File kosong atau tidak ada baris data' });
        }

        // Referensi kode_barang + nup yang sudah ada (untuk deteksi duplikat)
        const [existingRows] = await db.query('SELECT kode_barang, nup FROM master_aset');
        const existingKey = new Set(
            (existingRows || []).map(r => `${normalizeStr(r.kode_barang)}|${normalizeStr(r.nup)}`)
        );

        const seenKey = new Set();
        let success = 0;
        let failed = 0;
        const errors = [];
        const username = getUsernameFromToken(req.user);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            const jenisBmn = normalizeStr(row.jenis_bmn);
            const kodeBarang = normalizeStr(row.kode_barang);
            const namaBarang = normalizeStr(row.nama_barang);
            const nup = normalizeStr(row.nup);

            // Lewati baris kosong / baris catatan template
            if (!jenisBmn && !kodeBarang && !namaBarang) continue;
            if (looksLikeNote(jenisBmn) && !namaBarang) continue;

            if (!jenisBmn) { failed++; errors.push(`Baris ${rowNum}: jenis_bmn kosong`); continue; }
            if (!kodeBarang) { failed++; errors.push(`Baris ${rowNum}: kode_barang kosong`); continue; }
            if (!namaBarang) { failed++; errors.push(`Baris ${rowNum}: nama_barang kosong`); continue; }
            if (nup && isNaN(Number(nup))) {
                failed++; errors.push(`Baris ${rowNum}: nup harus berupa angka ("${nup}")`);
                continue;
            }

            const key = `${kodeBarang}|${nup}`;
            if (existingKey.has(key)) {
                failed++;
                errors.push(`Baris ${rowNum}: Barang kode_barang "${kodeBarang}"${nup ? ` NUP ${nup}` : ''} sudah ada (dilewati)`);
                continue;
            }
            if (seenKey.has(key)) {
                failed++;
                errors.push(`Baris ${rowNum}: Barang kode_barang "${kodeBarang}"${nup ? ` NUP ${nup}` : ''} duplikat di dalam file (dilewati)`);
                continue;
            }

            const tanggalPerolehan = parseExcelDate(row.tanggal_perolehan);
            const namaSatker = normalizeStr(row.nama_satker) || 'BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA';

            try {
                await db.query(
                    `INSERT INTO master_aset
                     (jenis_bmn, nama_satker, kode_barang, nup, nama_barang, status_bmn, merk, tipe, kondisi, intra_extra, tanggal_perolehan)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        jenisBmn,
                        namaSatker,
                        kodeBarang,
                        nup || null,
                        namaBarang,
                        normalizeStr(row.status_bmn) || 'Aktif',
                        normalizeStr(row.merk) || null,
                        normalizeStr(row.tipe) || null,
                        normalizeStr(row.kondisi) || 'Baik',
                        normalizeStr(row.intra_extra) || 'Intra',
                        tanggalPerolehan,
                    ]
                );
                seenKey.add(key);
                success++;
            } catch (e) {
                failed++;
                errors.push(`Baris ${rowNum}: ${e.message}`);
            }
        }

        console.log(`✅ Import barang BMN by ${username}: ${success} berhasil, ${failed} gagal`);
        res.json({
            success: true,
            message: `${success} berhasil, ${failed} gagal`,
            data: { success, failed, errors }
        });
    } catch (error) {
        console.error('Error import aset:', error);
        res.status(500).json({ success: false, message: 'Gagal import file', error: error.message });
    }
});

// GET /api/aset/export/xlsx - export semua Barang BMN
router.get('/export/xlsx', keycloakAuth, async (req, res) => {
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        const [rows] = await db.query(`
            SELECT jenis_bmn, nama_satker, kode_barang, nup, nama_barang, status_bmn,
                   merk, tipe, kondisi, intra_extra, tanggal_perolehan
            FROM master_aset
            ORDER BY kode_barang ASC, nup ASC
        `);

        const aoa = [[
            'No', 'Jenis BMN', 'Nama Satker', 'Kode Barang', 'NUP', 'Nama Barang',
            'Status BMN', 'Merk', 'Tipe', 'Kondisi', 'Intra/Ekstra', 'Tanggal Perolehan',
        ]];
        (rows || []).forEach((r, i) => {
            aoa.push([
                i + 1,
                normalizeStr(r.jenis_bmn),
                normalizeStr(r.nama_satker),
                normalizeStr(r.kode_barang),
                normalizeStr(r.nup),
                normalizeStr(r.nama_barang),
                normalizeStr(r.status_bmn),
                normalizeStr(r.merk),
                normalizeStr(r.tipe),
                normalizeStr(r.kondisi),
                normalizeStr(r.intra_extra),
                formatDateCell(r.tanggal_perolehan),
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = buildXlsxSheet(aoa, [
            { wch: 6 }, { wch: 20 }, { wch: 40 }, { wch: 22 }, { wch: 8 }, { wch: 36 },
            { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Barang BMN');

        console.log(`📤 Export Barang BMN: ${rows.length} baris`);
        sendWorkbook(res, wb, `barang-bmn-${todayFileStamp()}.xlsx`);
    } catch (error) {
        console.error('Error export aset:', error);
        res.status(500).json({ success: false, message: 'Gagal export data', error: error.message });
    }
});

// ========== GET ASET BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await db.query('SELECT * FROM master_aset WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Aset not found' 
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching aset by id:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== CREATE NEW ASET ==========
router.post('/', keycloakAuth, async (req, res) => {
    // Check if user has admin_pemeliharaan or admin role
    if (!hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ 
            success: false, 
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menambah barang.' 
        });
    }

    try {
        const {
            jenis_bmn,
            nama_satker,
            kode_barang,
            nup,
            nama_barang,
            status_bmn,
            merk,
            tipe,
            kondisi,
            intra_extra,
            tanggal_perolehan
        } = req.body;

        // Validasi required fields
        if (!jenis_bmn || !nama_barang) {
            return res.status(400).json({ 
                success: false, 
                message: 'Jenis BMN and Nama Barang are required' 
            });
        }

        const username = getUsernameFromToken(req.user);
        
        const [result] = await db.query(
            `INSERT INTO master_aset 
            (jenis_bmn, nama_satker, kode_barang, nup, nama_barang, status_bmn, 
             merk, tipe, kondisi, intra_extra, tanggal_perolehan) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                jenis_bmn,
                nama_satker || 'BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA',
                kode_barang,
                nup,
                nama_barang,
                status_bmn || 'Aktif',
                merk,
                tipe,
                kondisi || 'Baik',
                intra_extra || 'Intra',
                tanggal_perolehan || null
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Aset created successfully',
            data: {
                id: result.insertId,
                ...req.body
            },
            createdBy: username
        });
    } catch (error) {
        console.error('Error creating aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== UPDATE ASET ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    // Check if user has admin_pemeliharaan or admin role
    if (!hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ 
            success: false, 
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah barang.' 
        });
    }

    try {
        const { id } = req.params;
        const {
            jenis_bmn,
            nama_satker,
            kode_barang,
            nup,
            nama_barang,
            status_bmn,
            merk,
            tipe,
            kondisi,
            intra_extra,
            tanggal_perolehan
        } = req.body;

        // Cek apakah aset exist
        const [existing] = await db.query('SELECT id FROM master_aset WHERE id = ?', [id]);
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Aset not found' 
            });
        }

        const username = getUsernameFromToken(req.user);

        await db.query(
            `UPDATE master_aset 
            SET jenis_bmn = ?, nama_satker = ?, kode_barang = ?, nup = ?, 
                nama_barang = ?, status_bmn = ?, merk = ?, tipe = ?, 
                kondisi = ?, intra_extra = ?, tanggal_perolehan = ?
            WHERE id = ?`,
            [
                jenis_bmn,
                nama_satker,
                kode_barang,
                nup,
                nama_barang,
                status_bmn,
                merk,
                tipe,
                kondisi,
                intra_extra,
                tanggal_perolehan,
                id
            ]
        );

        res.json({
            success: true,
            message: 'Aset updated successfully',
            data: { id, ...req.body },
            updatedBy: username
        });
    } catch (error) {
        console.error('Error updating aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== DELETE ASET ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    // Check if user has admin_pemeliharaan or admin role
    if (!hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ 
            success: false, 
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus barang.' 
        });
    }

    try {
        const { id } = req.params;

        // Cek apakah aset exist
        const [existing] = await db.query('SELECT id FROM master_aset WHERE id = ?', [id]);
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Aset not found' 
            });
        }

        const username = getUsernameFromToken(req.user);

        await db.query('DELETE FROM master_aset WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Aset deleted successfully',
            deletedId: id,
            deletedBy: username
        });
    } catch (error) {
        console.error('Error deleting aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== SEARCH ASET ==========
router.get('/search/:keyword', keycloakAuth, async (req, res) => {
    try {
        const { keyword } = req.params;
        const searchTerm = `%${keyword}%`;

        const [rows] = await db.query(
            `SELECT * FROM master_aset 
            WHERE jenis_bmn LIKE ? 
            OR nama_barang LIKE ? 
            OR kode_barang LIKE ?
            OR merk LIKE ?
            OR tipe LIKE ?
            ORDER BY id DESC`,
            [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            keyword: keyword
        });
    } catch (error) {
        console.error('Error searching aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== FILTER BY JENIS BMN ==========
router.get('/jenis/:jenis', keycloakAuth, async (req, res) => {
    try {
        const { jenis } = req.params;

        const [rows] = await db.query(
            'SELECT * FROM master_aset WHERE jenis_bmn = ? ORDER BY id DESC',
            [jenis]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            jenis_bmn: jenis
        });
    } catch (error) {
        console.error('Error filtering by jenis:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== FILTER BY KONDISI ==========
router.get('/kondisi/:kondisi', keycloakAuth, async (req, res) => {
    try {
        const { kondisi } = req.params;

        const [rows] = await db.query(
            'SELECT * FROM master_aset WHERE kondisi = ? ORDER BY id DESC',
            [kondisi]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            kondisi: kondisi
        });
    } catch (error) {
        console.error('Error filtering by kondisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== FILTER BY STATUS ==========
router.get('/status/:status', keycloakAuth, async (req, res) => {
    try {
        const { status } = req.params;

        const [rows] = await db.query(
            'SELECT * FROM master_aset WHERE status_bmn = ? ORDER BY id DESC',
            [status]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            status_bmn: status
        });
    } catch (error) {
        console.error('Error filtering by status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET DISTINCT JENIS BMN ==========
router.get('/metadata/jenis', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT jenis_bmn FROM master_aset WHERE jenis_bmn IS NOT NULL AND jenis_bmn != "" ORDER BY jenis_bmn');
        
        res.json({
            success: true,
            data: rows.map(row => row.jenis_bmn)
        });
    } catch (error) {
        console.error('Error fetching jenis bmn:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET DISTINCT KONDISI ==========
router.get('/metadata/kondisi', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT kondisi FROM master_aset WHERE kondisi IS NOT NULL AND kondisi != "" ORDER BY kondisi');
        
        res.json({
            success: true,
            data: rows.map(row => row.kondisi)
        });
    } catch (error) {
        console.error('Error fetching kondisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET STATISTICS ==========
router.get('/statistics/summary', keycloakAuth, async (req, res) => {
    try {
        // Total aset
        const [total] = await db.query('SELECT COUNT(*) as total FROM master_aset');
        
        // Total per jenis
        const [perJenis] = await db.query('SELECT jenis_bmn, COUNT(*) as total FROM master_aset GROUP BY jenis_bmn ORDER BY total DESC');
        
        // Total per kondisi
        const [perKondisi] = await db.query('SELECT kondisi, COUNT(*) as total FROM master_aset WHERE kondisi IS NOT NULL GROUP BY kondisi');
        
        // Total per status
        const [perStatus] = await db.query('SELECT status_bmn, COUNT(*) as total FROM master_aset WHERE status_bmn IS NOT NULL GROUP BY status_bmn');
        
        // Total per intra_extra
        const [perIntraExtra] = await db.query('SELECT intra_extra, COUNT(*) as total FROM master_aset WHERE intra_extra IS NOT NULL GROUP BY intra_extra');

        res.json({
            success: true,
            data: {
                total_aset: total[0].total,
                per_jenis: perJenis,
                per_kondisi: perKondisi,
                per_status: perStatus,
                per_intra_extra: perIntraExtra
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== PAGINATION ==========
router.get('/page/:page', keycloakAuth, async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM master_aset');
        const total = countResult[0].total;

        // Get paginated data
        const [rows] = await db.query(
            'SELECT * FROM master_aset ORDER BY id DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: page,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching paginated aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== DEBUG ENDPOINT ==========
// GET /api/aset/debug/session
// Membantu memeriksa role APA yang sebenarnya dibaca server dari token.
router.get('/debug/session', keycloakAuth, async (req, res) => {
    try {
        // Decode token langsung dari header (req.user.accessToken ikut diisi server.js)
        const authHeader = req.headers.authorization || '';
        const rawToken = req.user.accessToken
            || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
        const decodedToken = rawToken ? decodeToken(rawToken) : null;

        const realmRoles = decodedToken?.realm_access?.roles || [];
        const clientRoles = Object.values(decodedToken?.resource_access || {})
            .flatMap((resource) => resource?.roles || []);
        const roles = [...new Set([...realmRoles, ...clientRoles])];

        // Role yang benar-benar dipakai oleh hasRole()/canModifyData()
        const detectedRoles = getUserRolesFromRequest(req);

        res.json({
            success: true,
            data: {
                username: req.user.username,
                realmRoles,
                clientRoles,
                tokenRoles: roles,
                detectedRoles,
                hasAdminRole: roles.includes('admin'),
                hasAdminPemeliharaanRole: roles.includes('admin_pemeliharaan'),
                canModify: hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin'])
            }
        });
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;