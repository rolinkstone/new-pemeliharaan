const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { getUsernameFromToken, decodeToken, getUserRolesFromRequest, hasRole, canModifyData, formatDateTimeForMySQL } = require('../utils/routeHelpers');

// ========== EXCEL (XLSX) SUPPORT ==========
const { XLSX, normalizeStr, todayLocalStr, parseExcelDate, readRowsWithAliases } = require('../utils/xlsxImport');
const { buildXlsxSheet, sendWorkbook, formatDateTimeCell, todayFileStamp } = require('../utils/xlsxExport');

// ========== TEMPLATE IMPORT POSISI ASET (XLSX) - endpoint publik ==========

// GET /api/asetRuangan/import/template - download template import
router.get('/import/template', async (req, res) => {
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        // Referensi dari DB (best-effort, template tetap bisa dibuat walau DB error)
        let asetRef = [];
        let ruanganRef = [];
        try {
            const [a] = await db.query(`
                SELECT id, kode_barang, nup, nama_barang, merk, jenis_bmn
                FROM master_aset
                ORDER BY kode_barang ASC, nup ASC
                LIMIT 2000
            `);
            asetRef = a || [];
        } catch (e) { console.error('Template aset ref error:', e.message); }
        try {
            const [r] = await db.query(`
                SELECT id, kode_ruangan, nama_ruangan, lokasi, is_active
                FROM ruangan
                ORDER BY kode_ruangan ASC
            `);
            ruanganRef = r || [];
        } catch (e) { console.error('Template ruangan ref error:', e.message); }

        const wb = XLSX.utils.book_new();

        // --- Sheet 1: Template Import (header saja) ---
        const header = ['kode_barang', 'nup', 'kode_ruangan', 'tgl_masuk', 'tgl_keluar', 'keterangan'];
        const ws = XLSX.utils.aoa_to_sheet([header]);
        ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import');

        // --- Sheet 2: Petunjuk ---
        const petunjuk = [
            ['PETUNJUK IMPORT POSISI ASET KE RUANGAN'],
            [''],
            ['1. Isi data pada sheet "Template Import" mulai baris ke-2 (jangan ubah baris header).'],
            ['2. Kolom wajib: kode_barang dan kode_ruangan.'],
            ['3. Gunakan sheet "Referensi Aset" / "Referensi Ruangan" untuk menyalin kode yang valid.'],
            ['4. Kolom tgl_masuk opsional (format YYYY-MM-DD). Jika kosong, otomatis diisi hari ini.'],
            ['5. Kolom tgl_keluar opsional, biarkan kosong untuk penempatan baru (status aktif).'],
            ['6. Aset yang sudah memiliki posisi AKTIF akan DILEWATI dan dicatat sebagai gagal.'],
            ['7. Satu baris = satu posisi aset. Jangan mengisi aset yang sama lebih dari sekali.'],
            [''],
            ['Contoh pengisian:'],
            ['kode_barang', 'nup', 'kode_ruangan', 'tgl_masuk', 'tgl_keluar', 'keterangan'],
            ['1010102001001', '1', 'R.001', '2026-01-15', '', 'Penempatan awal'],
        ];
        const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
        wsPetunjuk['!cols'] = [{ wch: 60 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

        // --- Sheet 3: Referensi Aset ---
        if (asetRef.length > 0) {
            const aoa = [['kode_barang', 'nup', 'nama_barang', 'merk', 'jenis_bmn', 'id']];
            asetRef.forEach(a => aoa.push([
                normalizeStr(a.kode_barang), normalizeStr(a.nup), normalizeStr(a.nama_barang),
                normalizeStr(a.merk), normalizeStr(a.jenis_bmn), a.id,
            ]));
            const wsAset = XLSX.utils.aoa_to_sheet(aoa);
            wsAset['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 42 }, { wch: 18 }, { wch: 18 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, wsAset, 'Referensi Aset');
        }

        // --- Sheet 4: Referensi Ruangan ---
        if (ruanganRef.length > 0) {
            const aoa = [['kode_ruangan', 'nama_ruangan', 'lokasi', 'is_active', 'id']];
            ruanganRef.forEach(r => aoa.push([
                normalizeStr(r.kode_ruangan), normalizeStr(r.nama_ruangan),
                normalizeStr(r.lokasi), r.is_active, r.id,
            ]));
            const wsRuangan = XLSX.utils.aoa_to_sheet(aoa);
            wsRuangan['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 28 }, { wch: 10 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, wsRuangan, 'Referensi Ruangan');
        }

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template_import_posisi_aset.xlsx');
        res.send(buf);
    } catch (error) {
        console.error('Error generate template import posisi aset:', error);
        res.status(500).json({ success: false, message: 'Gagal generate template', error: error.message });
    }
});

// POST /api/asetRuangan/import - import posisi aset dari file XLSX
router.post('/import', keycloakAuth, async (req, res) => {
    if (!canModifyData(req)) {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengimport posisi aset.'
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
            kode_barang: ['kode_barang', 'Kode Barang'],
            nup: ['nup', 'NUP'],
            kode_ruangan: ['kode_ruangan', 'Kode Ruangan'],
            nama_ruangan: ['nama_ruangan', 'Nama Ruangan'],
            tgl_masuk: ['tgl_masuk', 'Tgl Masuk', 'Tanggal Masuk'],
            tgl_keluar: ['tgl_keluar', 'Tgl Keluar', 'Tanggal Keluar'],
            keterangan: ['keterangan', 'Keterangan'],
            status: ['status', 'Status'],
        };
        const { rows, matched } = readRowsWithAliases(ws, ALIAS);

        if (!matched.includes('kode_barang') || !matched.includes('kode_ruangan')) {
            return res.status(400).json({
                success: false,
                message: 'Format header tidak dikenali. Gunakan template import atau file hasil Export dari aplikasi.',
                data: {
                    success: 0,
                    failed: 0,
                    errors: ['Kolom wajib tidak ditemukan: kode_barang, kode_ruangan.'],
                },
            });
        }
        if (!rows || rows.length === 0) {
            return res.status(400).json({ success: false, message: 'File kosong atau tidak ada baris data' });
        }

        // ---------- Prefetch referensi (menghindari query per baris) ----------
        const [asetRows] = await db.query('SELECT id, kode_barang, nup, nama_barang FROM master_aset');
        const [ruanganRows] = await db.query('SELECT id, kode_ruangan, nama_ruangan FROM ruangan');

        const asetByKode = new Map();    // kode_barang -> [aset]
        const asetByKodeNup = new Map(); // kode_barang|nup -> aset
        (asetRows || []).forEach(a => {
            const kode = normalizeStr(a.kode_barang);
            if (!kode) return;
            const nup = normalizeStr(a.nup);
            if (!asetByKode.has(kode)) asetByKode.set(kode, []);
            asetByKode.get(kode).push(a);
            asetByKodeNup.set(`${kode}|${nup}`, a);
        });

        const ruanganByKode = new Map();
        const ruanganByNama = new Map();
        (ruanganRows || []).forEach(r => {
            const kode = normalizeStr(r.kode_ruangan);
            const nama = normalizeStr(r.nama_ruangan).toLowerCase();
            if (kode && !ruanganByKode.has(kode)) ruanganByKode.set(kode, r);
            if (nama && !ruanganByNama.has(nama)) ruanganByNama.set(nama, r);
        });

        // Posisi yang saat ini aktif (satu aset maksimal satu posisi aktif)
        const [activeRows] = await db.query(`
            SELECT ar.aset_id, ar.ruangan_id, r.kode_ruangan, r.nama_ruangan
            FROM aset_ruangan ar
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE ar.status = 'aktif'
        `);
        const activeByAset = new Map();
        (activeRows || []).forEach(a => {
            if (!activeByAset.has(a.aset_id)) activeByAset.set(a.aset_id, a);
        });

        const insertedAsetIds = new Set();

        // Data yang sudah ada (aset + ruangan + tanggal) -> cegah duplikat saat re-import hasil Export
        const [tripletRows] = await db.query(`
            SELECT aset_id, ruangan_id, DATE_FORMAT(tgl_masuk, '%Y-%m-%d') AS tgl
            FROM aset_ruangan
        `);
        const existingTriplet = new Set(
            (tripletRows || []).map(t => `${t.aset_id}|${t.ruangan_id}|${t.tgl}`)
        );
        let success = 0;
        let failed = 0;
        const errors = [];
        const username = getUsernameFromToken(req.user);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            const kodeBarang = normalizeStr(row.kode_barang);
            const nup = normalizeStr(row.nup);
            const kodeRuangan = normalizeStr(row.kode_ruangan);
            const keterangan = normalizeStr(row.keterangan);

            // Lewati baris kosong / baris catatan pada template
            const looksLikeNote = /^[-•]/.test(kodeBarang) || /^keterangan/i.test(kodeBarang);
            if (!kodeRuangan && (looksLikeNote || !kodeBarang)) continue;

            if (!kodeBarang) { failed++; errors.push(`Baris ${rowNum}: kode_barang kosong`); continue; }
            if (!kodeRuangan) { failed++; errors.push(`Baris ${rowNum}: kode_ruangan kosong`); continue; }

            // ---------- Resolve aset ----------
            let aset = null;
            if (nup) {
                aset = asetByKodeNup.get(`${kodeBarang}|${nup}`) || null;
                if (!aset) {
                    failed++;
                    errors.push(`Baris ${rowNum}: Aset kode_barang "${kodeBarang}" NUP "${nup}" tidak ditemukan`);
                    continue;
                }
            } else {
                const list = asetByKode.get(kodeBarang) || [];
                if (list.length === 0) {
                    failed++;
                    errors.push(`Baris ${rowNum}: Aset dengan kode_barang "${kodeBarang}" tidak ditemukan`);
                    continue;
                }
                if (list.length > 1) {
                    const nupList = list.map(a => normalizeStr(a.nup)).filter(Boolean).slice(0, 8).join(', ');
                    failed++;
                    errors.push(`Baris ${rowNum}: kode_barang "${kodeBarang}" memiliki ${list.length} aset. Isi kolom nup (mis.: ${nupList || '-'})`);
                    continue;
                }
                aset = list[0];
            }

            // ---------- Resolve ruangan ----------
            let ruangan = ruanganByKode.get(kodeRuangan) || null;
            if (!ruangan && kodeRuangan) ruangan = ruanganByNama.get(kodeRuangan.toLowerCase()) || null;
            if (!ruangan) {
                const namaAlt = normalizeStr(row.nama_ruangan).toLowerCase();
                if (namaAlt) ruangan = ruanganByNama.get(namaAlt) || null;
            }
            if (!ruangan) {
                failed++;
                errors.push(`Baris ${rowNum}: Ruangan "${kodeRuangan}" tidak ditemukan`);
                continue;
            }

            // ---------- Cek duplikat (dilewati & dicatat sebagai gagal) ----------
            const existingActive = activeByAset.get(aset.id);
            if (existingActive) {
                const lokasi = normalizeStr(existingActive.kode_ruangan) || normalizeStr(existingActive.nama_ruangan) || `ID ${existingActive.ruangan_id}`;
                failed++;
                errors.push(`Baris ${rowNum}: Aset "${kodeBarang}"${nup ? ` NUP ${nup}` : ''} sudah aktif di ruangan ${lokasi} (dilewati)`);
                continue;
            }
            if (insertedAsetIds.has(aset.id)) {
                failed++;
                errors.push(`Baris ${rowNum}: Aset "${kodeBarang}"${nup ? ` NUP ${nup}` : ''} duplikat di dalam file (dilewati)`);
                continue;
            }

            // ---------- Tanggal ----------
            const tglMasuk = parseExcelDate(row.tgl_masuk) || todayLocalStr();
            let tglKeluar = null;
            if (normalizeStr(row.tgl_keluar)) {
                tglKeluar = parseExcelDate(row.tgl_keluar);
                if (!tglKeluar) {
                    failed++;
                    errors.push(`Baris ${rowNum}: Format tgl_keluar tidak dikenal "${normalizeStr(row.tgl_keluar)}"`);
                    continue;
                }
            }
            // Status: pakai dari file bila valid, jika tidak turunkan dari tgl_keluar
            const STATUS_VALID = ['aktif', 'dipindah', 'dihapuskan'];
            const statusInput = normalizeStr(row.status).toLowerCase();
            const status = STATUS_VALID.includes(statusInput) ? statusInput : (tglKeluar ? 'dipindah' : 'aktif');

            // Cegah duplikat (aset + ruangan + tanggal) saat meng-import ulang hasil Export
            const triplet = `${aset.id}|${ruangan.id}|${tglMasuk}`;
            if (existingTriplet.has(triplet)) {
                failed++;
                errors.push(`Baris ${rowNum}: Data serupa sudah ada (aset, ruangan, tanggal sama) - dilewati`);
                continue;
            }

            try {
                await db.query(
                    `INSERT INTO aset_ruangan (aset_id, ruangan_id, tgl_masuk, tgl_keluar, status, keterangan)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        aset.id,
                        ruangan.id,
                        formatDateTimeForMySQL(tglMasuk),
                        formatDateTimeForMySQL(tglKeluar),
                        status,
                        keterangan || null,
                    ]
                );
                insertedAsetIds.add(aset.id);
                existingTriplet.add(triplet);
                if (status === 'aktif') {
                    activeByAset.set(aset.id, {
                        aset_id: aset.id,
                        ruangan_id: ruangan.id,
                        kode_ruangan: ruangan.kode_ruangan,
                        nama_ruangan: ruangan.nama_ruangan,
                    });
                }
                success++;
            } catch (e) {
                failed++;
                errors.push(`Baris ${rowNum}: ${e.message}`);
            }
        }

        console.log(`✅ Import posisi aset by ${username}: ${success} berhasil, ${failed} gagal`);
        res.json({
            success: true,
            message: `${success} berhasil, ${failed} gagal`,
            data: { success, failed, errors }
        });
    } catch (error) {
        console.error('Error import posisi aset:', error);
        res.status(500).json({ success: false, message: 'Gagal import file', error: error.message });
    }
});

// GET /api/asetRuangan/export/xlsx - export semua posisi aset
router.get('/export/xlsx', keycloakAuth, async (req, res) => {
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        const [rows] = await db.query(`
            SELECT ar.tgl_masuk, ar.tgl_keluar, ar.status, ar.keterangan,
                   ma.kode_barang, ma.nup, ma.nama_barang,
                   r.kode_ruangan, r.nama_ruangan
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            ORDER BY ar.tgl_masuk DESC
        `);

        const aoa = [[
            'No', 'Kode Barang', 'NUP', 'Nama Barang', 'Kode Ruangan', 'Nama Ruangan',
            'Tgl Masuk', 'Tgl Keluar', 'Status', 'Keterangan',
        ]];
        (rows || []).forEach((r, i) => {
            aoa.push([
                i + 1,
                normalizeStr(r.kode_barang),
                normalizeStr(r.nup),
                normalizeStr(r.nama_barang),
                normalizeStr(r.kode_ruangan),
                normalizeStr(r.nama_ruangan),
                formatDateTimeCell(r.tgl_masuk),
                formatDateTimeCell(r.tgl_keluar),
                normalizeStr(r.status),
                normalizeStr(r.keterangan),
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = buildXlsxSheet(aoa, [
            { wch: 6 }, { wch: 22 }, { wch: 8 }, { wch: 34 }, { wch: 16 }, { wch: 30 },
            { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 40 },
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Posisi Aset');

        console.log(`📤 Export posisi aset: ${rows.length} baris`);
        sendWorkbook(res, wb, `posisi-aset-${todayFileStamp()}.xlsx`);
    } catch (error) {
        console.error('Error export posisi aset:', error);
        res.status(500).json({ success: false, message: 'Gagal export data', error: error.message });
    }
});

// ========== GET STATISTICS (Semua user bisa akses) ==========
router.get('/statistics', keycloakAuth, async (req, res) => {
    try {
        console.log('📊 Statistics endpoint accessed');
        
        // Hitung total semua record
        const [total] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan');
        
        // Hitung berdasarkan status
        const [aktif] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan WHERE status = "aktif"');
        const [dipindah] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan WHERE status = "dipindah"');
        const [dihapuskan] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan WHERE status = "dihapuskan"');
        
        // Hitung unique aset
        const [uniqueAset] = await db.query('SELECT COUNT(DISTINCT aset_id) as total FROM aset_ruangan');
        
        const statistics = {
            total: total[0]?.total || 0,
            aktif: aktif[0]?.total || 0,
            dipindah: dipindah[0]?.total || 0,
            dihapuskan: dihapuskan[0]?.total || 0,
            unique_aset: uniqueAset[0]?.total || 0
        };
        
        console.log('📊 Statistics from DB:', statistics);
        
        res.json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil statistik',
            error: error.message 
        });
    }
});

// ========== GET ALL ASET RUANGAN (DENGAN FILTER) - Semua user bisa akses ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { status, aset_id, ruangan_id, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Sumber data + join (dipakai bersama oleh query data & query count)
        const baseFrom = `
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
        `;

        const where = ['1=1'];
        const whereParams = [];

        if (status && status !== 'all') {
            where.push('ar.status = ?');
            whereParams.push(status);
        }

        if (aset_id) {
            where.push('ar.aset_id = ?');
            whereParams.push(aset_id);
        }

        if (ruangan_id) {
            where.push('ar.ruangan_id = ?');
            whereParams.push(ruangan_id);
        }

        // Pencarian teks: kode/nama/NUP aset, kode/nama ruangan, dan keterangan
        if (search && normalizeStr(search)) {
            const term = `%${normalizeStr(search)}%`;
            where.push(`(
                ma.kode_barang LIKE ? OR ma.nama_barang LIKE ? OR ma.nup LIKE ?
                OR r.kode_ruangan LIKE ? OR r.nama_ruangan LIKE ?
                OR ar.keterangan LIKE ?
            )`);
            whereParams.push(term, term, term, term, term, term);
        }

        const whereSql = `WHERE ${where.join(' AND ')}`;

        // Total count (ikut join agar bisa mencari kolom aset/ruangan)
        const [countResult] = await db.query(`SELECT COUNT(*) as total ${baseFrom} ${whereSql}`, whereParams);
        const total = countResult && countResult[0] ? countResult[0].total : 0;

        // Data + pagination
        const [rows] = await db.query(
            `SELECT ar.*,
                    ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup,
                    r.nama_ruangan, r.kode_ruangan, r.lokasi
             ${baseFrom} ${whereSql}
             ORDER BY ar.tgl_masuk DESC
             LIMIT ? OFFSET ?`,
            [...whereParams, parseInt(limit), parseInt(offset)]
        );

        res.json({
            success: true,
            data: rows || [],
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data posisi aset',
            error: error.message 
        });
    }
});

// ========== GET SINGLE ASET RUANGAN BY ID - Semua user bisa akses ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await db.query(`
            SELECT ar.*, 
                   ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup,
                   r.nama_ruangan, r.kode_ruangan, r.lokasi
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE ar.id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan' 
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET RIWAYAT LOKASI ASET - Semua user bisa akses ==========
router.get('/aset/:asetId', keycloakAuth, async (req, res) => {
    try {
        const { asetId } = req.params;
        
        const [rows] = await db.query(`
            SELECT ar.*, 
                   r.nama_ruangan, r.kode_ruangan, r.lokasi
            FROM aset_ruangan ar
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE ar.aset_id = ?
            ORDER BY ar.tgl_masuk DESC
        `, [asetId]);
        
        // Get aset info
        const [asetInfo] = await db.query(
            'SELECT id, kode_barang, nama_barang, jenis_bmn FROM master_aset WHERE id = ?',
            [asetId]
        );
        
        res.json({
            success: true,
            data: rows || [],
            aset: asetInfo[0] || null
        });
    } catch (error) {
        console.error('Error fetching riwayat aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil riwayat aset',
            error: error.message 
        });
    }
});

// ========== GET ASET BY RUANGAN (AKTIF) - Semua user bisa akses ==========
router.get('/ruangan/:ruanganId', keycloakAuth, async (req, res) => {
    try {
        const { ruanganId } = req.params;
        
        const [rows] = await db.query(`
            SELECT ar.*, 
                   ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            WHERE ar.ruangan_id = ? AND ar.status = 'aktif'
            ORDER BY ar.tgl_masuk DESC
        `, [ruanganId]);
        
        // Get ruangan info
        const [ruanganInfo] = await db.query(
            'SELECT id, kode_ruangan, nama_ruangan, lokasi FROM ruangan WHERE id = ?',
            [ruanganId]
        );
        
        res.json({
            success: true,
            data: rows || [],
            ruangan: ruanganInfo[0] || null
        });
    } catch (error) {
        console.error('Error fetching aset by ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil aset di ruangan',
            error: error.message 
        });
    }
});

// ========== GET AKTIF (SEMUA ASET AKTIF) - Semua user bisa akses ==========
router.get('/status/aktif', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT ar.*, 
                   ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup,
                   r.nama_ruangan, r.kode_ruangan, r.lokasi
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE ar.status = 'aktif'
            ORDER BY ar.tgl_masuk DESC
        `);
        
        res.json({
            success: true,
            data: rows || [],
            total: rows.length
        });
    } catch (error) {
        console.error('Error fetching aktif aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil aset aktif',
            error: error.message 
        });
    }
});

// ========== CREATE NEW PLACEMENT (INITIAL) - Hanya admin_pemeliharaan dan admin ==========
router.post('/', keycloakAuth, async (req, res) => {
    // Check access rights
    if (!canModifyData(req)) {
        console.log('❌ Create placement: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menempatkan aset.'
        });
    }

    try {
        let { aset_id, ruangan_id, tgl_masuk, tgl_keluar, keterangan } = req.body;

        if (!aset_id || !ruangan_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aset ID dan Ruangan ID harus diisi' 
            });
        }

        // Cek apakah aset sudah pernah ditempatkan dan masih aktif
        const [existing] = await db.query(
            'SELECT id FROM aset_ruangan WHERE aset_id = ? AND status = "aktif"',
            [aset_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aset sudah aktif di ruangan lain. Gunakan fitur pindah lokasi.' 
            });
        }

        const username = getUsernameFromToken(req.user);
        
        // Format tanggal untuk MySQL
        const formattedTglMasuk = formatDateTimeForMySQL(tgl_masuk) || formatDateTimeForMySQL(new Date());
        const formattedTglKeluar = formatDateTimeForMySQL(tgl_keluar);

        console.log('Create - Original tgl_masuk:', tgl_masuk);
        console.log('Create - Formatted tgl_masuk:', formattedTglMasuk);

        const [result] = await db.query(
            `INSERT INTO aset_ruangan (aset_id, ruangan_id, tgl_masuk, tgl_keluar, status, keterangan) 
             VALUES (?, ?, ?, ?, 'aktif', ?)`,
            [aset_id, ruangan_id, formattedTglMasuk, formattedTglKeluar, keterangan]
        );

        console.log(`✅ Aset placement created by ${username}: Aset ID ${aset_id} -> Ruangan ID ${ruangan_id}`);

        res.status(201).json({
            success: true,
            message: 'Aset berhasil ditempatkan',
            data: {
                id: result.insertId,
                aset_id,
                ruangan_id,
                tgl_masuk: formattedTglMasuk
            },
            createdBy: username
        });
    } catch (error) {
        console.error('Error placing aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menempatkan aset',
            error: error.message 
        });
    }
});

// ========== PINDAH LOKASI ASET - Hanya admin_pemeliharaan dan admin ==========
router.post('/pindah', keycloakAuth, async (req, res) => {
    // Check access rights
    if (!canModifyData(req)) {
        console.log('❌ Move aset: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat memindahkan aset.'
        });
    }

    try {
        let { aset_id, ruangan_baru_id, tgl_pindah, keterangan } = req.body;

        if (!aset_id || !ruangan_baru_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aset ID dan Ruangan Baru ID harus diisi' 
            });
        }

        const username = getUsernameFromToken(req.user);
        
        // Format tanggal untuk MySQL
        const formattedTglPindah = formatDateTimeForMySQL(tgl_pindah) || formatDateTimeForMySQL(new Date());

        console.log('Pindah - Original tgl_pindah:', tgl_pindah);
        console.log('Pindah - Formatted tgl_pindah:', formattedTglPindah);

        // Mulai transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Cek lokasi aktif saat ini
            const [lokasiAktif] = await connection.query(
                'SELECT * FROM aset_ruangan WHERE aset_id = ? AND status = "aktif"',
                [aset_id]
            );

            if (lokasiAktif.length === 0) {
                await connection.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: 'Tidak ada lokasi aktif untuk aset ini. Gunakan fitur tempatkan aset.' 
                });
            }

            // Update lokasi lama menjadi dipindah
            await connection.query(
                `UPDATE aset_ruangan 
                 SET status = 'dipindah', tgl_keluar = ?, keterangan = CONCAT(IFNULL(keterangan, ''), '\n', ?)
                 WHERE id = ?`,
                [formattedTglPindah, `Dipindah ke ruangan ID: ${ruangan_baru_id} - ${keterangan || ''}`, lokasiAktif[0].id]
            );

            // Insert lokasi baru
            const [result] = await connection.query(
                `INSERT INTO aset_ruangan (aset_id, ruangan_id, tgl_masuk, status, keterangan) 
                 VALUES (?, ?, ?, 'aktif', ?)`,
                [aset_id, ruangan_baru_id, formattedTglPindah, keterangan]
            );

            await connection.commit();

            console.log(`✅ Aset moved by ${username}: Aset ID ${aset_id} -> Ruangan ID ${ruangan_baru_id}`);

            res.json({
                success: true,
                message: 'Aset berhasil dipindahkan',
                data: {
                    id: result.insertId,
                    aset_id,
                    ruangan_baru_id,
                    tgl_pindah: formattedTglPindah,
                    from_ruangan: lokasiAktif[0].ruangan_id
                },
                updatedBy: username
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error moving aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memindahkan aset',
            error: error.message 
        });
    }
});

// ========== CATAT KELUAR ASET - Hanya admin_pemeliharaan dan admin ==========
router.post('/:id/keluar', keycloakAuth, async (req, res) => {
    // Check access rights
    if (!canModifyData(req)) {
        console.log('❌ Record exit: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mencatat aset keluar.'
        });
    }

    try {
        const { id } = req.params;
        let { tgl_keluar, status, keterangan } = req.body;

        if (!tgl_keluar) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tanggal keluar harus diisi' 
            });
        }

        // Format tanggal untuk MySQL
        const formattedTglKeluar = formatDateTimeForMySQL(tgl_keluar);
        
        console.log('Keluar - Data:', { id, tgl_keluar, status, keterangan });

        // Cek apakah data exist dan masih aktif
        const [existing] = await db.query(
            'SELECT * FROM aset_ruangan WHERE id = ? AND status = "aktif"',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan atau sudah tidak aktif' 
            });
        }

        const username = getUsernameFromToken(req.user);

        // Gunakan status dari request, default ke 'dipindah' jika tidak ada
        const newStatus = status || 'dipindah';
        
        await db.query(
            `UPDATE aset_ruangan 
             SET status = ?, tgl_keluar = ?, keterangan = CONCAT(IFNULL(keterangan, ''), '\n', ?)
             WHERE id = ?`,
            [newStatus, formattedTglKeluar, keterangan || `Aset ${newStatus}`, id]
        );

        console.log(`✅ Aset exit recorded by ${username}: ID ${id} -> Status ${newStatus}`);

        res.json({
            success: true,
            message: `Aset berhasil dicatat ${newStatus === 'dipindah' ? 'dipindah' : 'keluar (dihapuskan)'}`,
            updatedBy: username
        });
    } catch (error) {
        console.error('Error catat keluar:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mencatat keluar',
            error: error.message 
        });
    }
});

// ========== UPDATE DATA ASET RUANGAN - Hanya admin_pemeliharaan dan admin ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    // Check access rights
    if (!canModifyData(req)) {
        console.log('❌ Update aset: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah data.'
        });
    }

    try {
        const { id } = req.params;
        let { ruangan_id, tgl_masuk, tgl_keluar, status, keterangan } = req.body;

        // Cek apakah data exist
        const [existing] = await db.query('SELECT id FROM aset_ruangan WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan' 
            });
        }

        // Format tanggal untuk MySQL
        const formattedTglMasuk = formatDateTimeForMySQL(tgl_masuk);
        const formattedTglKeluar = formatDateTimeForMySQL(tgl_keluar);

        console.log('Update - Original tgl_masuk:', tgl_masuk);
        console.log('Update - Formatted tgl_masuk:', formattedTglMasuk);
        console.log('Update - Original tgl_keluar:', tgl_keluar);
        console.log('Update - Formatted tgl_keluar:', formattedTglKeluar);

        const username = getUsernameFromToken(req.user);

        await db.query(
            `UPDATE aset_ruangan 
             SET ruangan_id = ?, tgl_masuk = ?, tgl_keluar = ?, status = ?, keterangan = ?
             WHERE id = ?`,
            [ruangan_id, formattedTglMasuk, formattedTglKeluar, status, keterangan, id]
        );

        console.log(`✅ Aset placement updated by ${username}: ID ${id}`);

        res.json({
            success: true,
            message: 'Data berhasil diperbarui',
            updatedBy: username
        });
    } catch (error) {
        console.error('Error updating aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memperbarui data',
            error: error.message 
        });
    }
});

// ========== DELETE ASET RUANGAN - Hanya admin_pemeliharaan dan admin ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    // Check access rights
    if (!canModifyData(req)) {
        console.log('❌ Delete aset: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus data.'
        });
    }

    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM aset_ruangan WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan' 
            });
        }

        const username = getUsernameFromToken(req.user);

        console.log(`✅ Aset placement deleted by ${username}: ID ${id}`);

        res.json({
            success: true,
            message: 'Data berhasil dihapus',
            deletedBy: username
        });
    } catch (error) {
        console.error('Error deleting aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menghapus data',
            error: error.message 
        });
    }
});

// ========== OPTIONS FOR DROPDOWNS - Semua user bisa akses ==========
router.get('/options/aset', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, kode_barang, nama_barang, merk, nup, jenis_bmn 
            FROM master_aset 
            ORDER BY kode_barang
        `);
        res.json({ success: true, data: rows || [] });
    } catch (error) {
        console.error('Error fetching aset options:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data aset',
            error: error.message 
        });
    }
});

// ========== OPTIONS FOR DROPDOWNS - Semua user bisa akses ==========
router.get('/options/ruangan', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, kode_ruangan, nama_ruangan, lokasi, is_active 
            FROM ruangan 
            WHERE is_active = 1 
            ORDER BY kode_ruangan
        `);
        console.log('📋 Ruangan options (aktif):', rows.length);
        res.json({ success: true, data: rows || [] });
    } catch (error) {
        console.error('Error fetching ruangan options:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data ruangan',
            error: error.message 
        });
    }
});

// ========== DEBUG ENDPOINT ==========
router.get('/debug/session', keycloakAuth, async (req, res) => {
    try {
        const roles = getUserRolesFromRequest(req);
        
        res.json({
            success: true,
            data: {
                username: req.user?.preferred_username || req.user?.username || 'unknown',
                roles: roles,
                hasAdminRole: roles.includes('admin'),
                hasAdminPemeliharaanRole: roles.includes('admin_pemeliharaan'),
                canModify: roles.includes('admin') || roles.includes('admin_pemeliharaan') || roles.includes('superadmin')
            }
        });
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;