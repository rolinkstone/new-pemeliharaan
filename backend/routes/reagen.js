const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { getUsernameFromToken, hasRole } = require('../utils/routeHelpers');
let XLSX = null;
try { XLSX = require('xlsx-js-style'); } catch (e) {
    try { XLSX = require('xlsx'); } catch (e2) { console.log('⚠️ xlsx not installed, import disabled'); }
}

// ========== HELPERS ==========
const getUsername = (req) => req.user?.name || req.user?.username || req.user?.preferred_username || req.user?.email || 'system';

const LAB_TUJUAN = ['pangan', 'mikro', 'terano'];
const getLabTujuan = (v) => (LAB_TUJUAN.includes(v) ? v : 'pangan');

const createNotif = async (userId, userRole, title, message, link) => {
    try {
        await db.query(
            'INSERT INTO notifications (user_id, user_role, title, message, link) VALUES (?, ?, ?, ?, ?)',
            [userId || '', userRole, title, message, link || '/persediaan/reagen']
        );
    } catch (e) { console.error('Notif error:', e.message); }
};

/**
 * Parse berat_volume master reagen ke satuan LAB (gram / mL)
 * Contoh: "1000 g" -> { qty: 1000, unit: 'g' }
 *         "1 KG"  -> { qty: 1000, unit: 'g' }
 *         "500 mL"-> { qty: 500, unit: 'mL' }
 *         "2.5 L" -> { qty: 2500, unit: 'mL' }
 *         "4 L"   -> { qty: 4000, unit: 'mL' }
 *         "-"     -> { qty: 1, unit: 'g' } (default)
 */
function parseBerat(beratVolume) {
    if (!beratVolume) return { qty: 1, unit: 'g' };
    const s = String(beratVolume).trim().toLowerCase();
    const m = s.match(/^([\d.,]+)\s*(g|kg|ml|l|mg)\b/i);
    if (!m) return { qty: 1, unit: 'g' };
    let qty = parseFloat(m[1].replace(',', '.'));
    const u = m[2].toLowerCase();
    if (isNaN(qty) || qty <= 0) qty = 1;
    if (u === 'kg') return { qty: qty * 1000, unit: 'g' };
    if (u === 'g' || u === 'mg') return { qty: u === 'mg' ? qty / 1000 : qty, unit: 'g' };
    if (u === 'l') return { qty: qty * 1000, unit: 'mL' };
    if (u === 'ml') return { qty, unit: 'mL' };
    return { qty: 1, unit: 'g' };
}

// ========== MASTER REAGEN ==========

// GET all reagen (master) with pagination & filter
router.get('/reagen', keycloakAuth, async (req, res) => {
    try {
        const { search, kategori, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = ' WHERE 1=1';
        const params = [];
        if (search) {
            whereClause += ' AND (nama_barang LIKE ? OR kode_barang LIKE ? OR kode_lama LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        if (kategori) {
            whereClause += ' AND kategori = ?';
            params.push(kategori);
        }

        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM reagen${whereClause}`, params);
        const total = countResult[0]?.total || 0;

        const [rows] = await db.query(
            `SELECT * FROM reagen${whereClause} ORDER BY kategori ASC, no_urut ASC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        res.json({
            success: true,
            data: rows,
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('Error fetch reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data reagen', error: error.message });
    }
});

// GET filter options (kategori)
router.get('/reagen/filter-options', keycloakAuth, async (req, res) => {
    try {
        const [kategori] = await db.query('SELECT DISTINCT kategori FROM reagen WHERE kategori != "" ORDER BY kategori');
        res.json({ success: true, data: { kategori: kategori.map(r => r.kategori) } });
    } catch (error) {
        console.error('Error fetch filter options reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// GET all reagen (unpaginated) for dropdowns
router.get('/reagen/all', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM reagen ORDER BY kategori ASC, no_urut ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetch all reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// POST create reagen
router.post('/reagen', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin', 'kabag_tu'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        const { kode_barang, no_urut, kategori, nama_barang, berat_volume, satuan_kemasan, kode_lama, satuan } = req.body;
        if (!nama_barang) {
            return res.status(400).json({ success: false, message: 'Nama barang wajib diisi' });
        }
        const username = getUsername(req);
        const [result] = await db.query(
            `INSERT INTO reagen (kode_barang, no_urut, kategori, nama_barang, berat_volume, satuan_kemasan, kode_lama, satuan, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                kode_barang || '', no_urut || '', kategori || 'Bahan Kimia Padat',
                nama_barang, berat_volume || '', satuan_kemasan || 'Botol',
                kode_lama || '', satuan || satuan_kemasan || 'Botol', username
            ]
        );
        res.json({ success: true, data: { id: result.insertId }, message: 'Reagen berhasil ditambahkan' });
    } catch (error) {
        console.error('Error create reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal menambah reagen', error: error.message });
    }
});

// PUT update reagen
router.put('/reagen/:id', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin', 'kabag_tu'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        const { id } = req.params;
        const { kode_barang, no_urut, kategori, nama_barang, berat_volume, satuan_kemasan, kode_lama, satuan } = req.body;
        await db.query(
            `UPDATE reagen SET kode_barang=?, no_urut=?, kategori=?, nama_barang=?, berat_volume=?, satuan_kemasan=?, kode_lama=?, satuan=? WHERE id=?`,
            [kode_barang || '', no_urut || '', kategori || '', nama_barang, berat_volume || '', satuan_kemasan || '', kode_lama || '', satuan || '', id]
        );
        res.json({ success: true, message: 'Reagen berhasil diupdate' });
    } catch (error) {
        console.error('Error update reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal update reagen', error: error.message });
    }
});

// DELETE reagen
router.delete('/reagen/:id', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        const { id } = req.params;
        await db.query('DELETE FROM reagen WHERE id=?', [id]);
        res.json({ success: true, message: 'Reagen berhasil dihapus' });
    } catch (error) {
        console.error('Error delete reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal hapus reagen', error: error.message });
    }
});

// ========== STOK GUDANG PER BATCH / EXPIRY ==========

// GET stok gudang per reagen dengan rincian batch (expiry)
router.get('/reagen/stok', keycloakAuth, async (req, res) => {
    try {
        const { kategori, search, expiring } = req.query;
        let whereClause = ' WHERE 1=1';
        const params = [];
        if (kategori) { whereClause += ' AND r.kategori = ?'; params.push(kategori); }
        if (search) {
            whereClause += ' AND (r.nama_barang LIKE ? OR r.kode_barang LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }

        const [rows] = await db.query(
            `SELECT r.*, b.id as batch_id, b.no_batch, b.tanggal_kadaluarsa, b.stok_botol as stok_batch
             FROM reagen r
             LEFT JOIN reagen_batch b ON b.reagen_id = r.id
             ${whereClause}
             ORDER BY r.kategori ASC, r.no_urut ASC, b.tanggal_kadaluarsa ASC`,
            params
        );

        // Group by reagen, list batches
        const map = {};
        for (const r of rows) {
            if (!map[r.id]) {
                map[r.id] = {
                    id: r.id,
                    kode_barang: r.kode_barang,
                    no_urut: r.no_urut,
                    kategori: r.kategori,
                    nama_barang: r.nama_barang,
                    berat_volume: r.berat_volume,
                    satuan_kemasan: r.satuan_kemasan,
                    kode_lama: r.kode_lama,
                    satuan: r.satuan,
                    saldo_botol: Number(r.saldo_botol) || 0,
                    batches: []
                };
            }
            if (r.batch_id) {
                map[r.id].batches.push({
                    batch_id: r.batch_id,
                    no_batch: r.no_batch,
                    tanggal_kadaluarsa: r.tanggal_kadaluarsa,
                    stok_botol: Number(r.stok_batch) || 0
                });
            }
        }

        let result = Object.values(map);
        // Filter hanya yang mendekati kadaluarsa (opsional)
        if (expiring === '1') {
            const today = new Date().toISOString().split('T')[0];
            result = result.filter(r => r.batches.some(b => b.tanggal_kadaluarsa && b.tanggal_kadaluarsa <= today));
        }

        res.json({ success: true, data: result, total: result.length });
    } catch (error) {
        console.error('Error fetch stok reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil stok', error: error.message });
    }
});

// ========== IMPORT STOK GUDANG (XLSX) ==========

// GET download template import stok gudang
router.get('/reagen/import-stok/template', async (req, res) => {
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['kode_barang', 'no_batch', 'tanggal_kadaluarsa', 'jumlah_botol'],
            ['1010102001001', 'B001', '2026-12-31', '10'],
            ['1010102001002', '', '2027-06-30', '5'],
            ['', '', '', ''],
            ['Keterangan:', '', '', ''],
            ['- kode_barang (wajib): kode dari Master Reagen', '', '', ''],
            ['- no_batch (opsional): kosong = dibuat otomatis', '', '', ''],
            ['- tanggal_kadaluarsa (opsional): format YYYY-MM-DD', '', '', ''],
            ['- jumlah_botol (wajib): angka > 0. Jika batch sama, stok ditambahkan.', '', '', ''],
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Template Stok');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template_import_stok_reagen.xlsx');
        res.send(buf);
    } catch (error) {
        console.error('Error generate template:', error);
        res.status(500).json({ success: false, message: 'Gagal generate template', error: error.message });
    }
});

// POST import stok gudang dari file XLSX (per batch)
router.post('/reagen/import-stok', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin', 'kabag_tu'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang yang dapat mengimport stok gudang.' });
    }
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        const { fileBase64 } = req.body;
        if (!fileBase64) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });

        const buf = Buffer.from(fileBase64, 'base64');
        const wb = XLSX.read(buf, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) return res.status(400).json({ success: false, message: 'File kosong atau format salah' });

        const conn = await db.pool.getConnection();
        let success = 0, failed = 0, errors = [];
        try {
            await conn.beginTransaction();

            // Cache master reagen by kode_barang
            const [master] = await conn.query('SELECT id, kode_barang, nama_barang FROM reagen');
            const reagenMap = new Map(master.map(r => [String(r.kode_barang).trim(), r]));

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const kode = String(row.kode_barang || '').trim();
                const batchNo = String(row.no_batch || '').trim();
                const jumlah = parseInt(row.jumlah_botol, 10);
                const tglRaw = row.tanggal_kadaluarsa ? String(row.tanggal_kadaluarsa).trim() : '';

                // Normalisasi tanggal kadaluarsa (mendukung teks YYYY-MM-DD & serial Excel)
                let expDate = null;
                if (tglRaw) {
                    if (/^\d{4}-\d{2}-\d{2}/.test(tglRaw)) {
                        expDate = tglRaw.slice(0, 10);
                    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(tglRaw)) {
                        const p = tglRaw.split('/');
                        expDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                    } else if (/^\d{4}-\d{1,2}-\d{1,2}/.test(tglRaw)) {
                        const p = tglRaw.split('-');
                        expDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                    } else {
                        const serial = parseFloat(tglRaw);
                        if (!isNaN(serial) && serial > 20000) {
                            const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
                            expDate = d.toISOString().slice(0, 10);
                        } else {
                            failed++;
                            errors.push(`Baris ${i + 2}: Format tanggal kadaluarsa tidak dikenal "${tglRaw}"`);
                            continue;
                        }
                    }
                }

                if (!kode) {
                    failed++;
                    errors.push(`Baris ${i + 2}: kode_barang kosong`);
                    continue;
                }
                if (!jumlah || jumlah <= 0) {
                    failed++;
                    errors.push(`Baris ${i + 2}: jumlah_botol harus angka > 0`);
                    continue;
                }

                const reagen = reagenMap.get(kode);
                if (!reagen) {
                    failed++;
                    errors.push(`Baris ${i + 2}: Reagen dengan kode "${kode}" tidak ditemukan`);
                    continue;
                }

                const batch = batchNo || `B${Date.now().toString().slice(-6)}${i}`;
                const [existing] = await conn.query(
                    'SELECT id FROM reagen_batch WHERE reagen_id=? AND no_batch=?',
                    [reagen.id, batch]
                );
                if (existing.length > 0) {
                    await conn.query(
                        'UPDATE reagen_batch SET stok_botol = stok_botol + ?, tanggal_kadaluarsa = COALESCE(?, tanggal_kadaluarsa) WHERE id=?',
                        [jumlah, expDate, existing[0].id]
                    );
                } else {
                    await conn.query(
                        'INSERT INTO reagen_batch (reagen_id, no_batch, tanggal_kadaluarsa, stok_botol) VALUES (?, ?, ?, ?)',
                        [reagen.id, batch, expDate, jumlah]
                    );
                }
                await conn.query('UPDATE reagen SET saldo_botol = saldo_botol + ? WHERE id=?', [jumlah, reagen.id]);
                success++;
            }

            await conn.commit();
            res.json({ success: true, message: `${success} berhasil, ${failed} gagal`, data: { success, failed, errors } });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error import stok xlsx:', error);
        res.status(500).json({ success: false, message: 'Gagal import file', error: error.message });
    }
});

// ========== BARANG MASUK GUDANG (batch + expiry) ==========

// GET barang masuk reagen
router.get('/reagen/masuk', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT rm.*, r.nama_barang, r.kategori, r.satuan, r.berat_volume
            FROM reagen_masuk rm
            LEFT JOIN reagen r ON rm.reagen_id = r.id
            ORDER BY rm.created_at DESC
        `);
        res.json({ success: true, data: rows, total: rows.length });
    } catch (error) {
        console.error('Error fetch masuk reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data', error: error.message });
    }
});

// POST barang masuk gudang — tambah batch stock + saldo botol
router.post('/reagen/masuk', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang yang dapat menambah barang masuk.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { reagen_id, no_batch, jumlah_botol, tanggal_kadaluarsa, kuitansi_url, catatan, tanggal_pembelian } = req.body;
        if (!reagen_id || !jumlah_botol || jumlah_botol <= 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Reagen dan jumlah botol wajib diisi' });
        }
        const username = getUsername(req);
        const batch = no_batch || `B${Date.now().toString().slice(-6)}`;

        // Insert record masuk
        await conn.query(
            `INSERT INTO reagen_masuk (reagen_id, no_batch, jumlah_botol, tanggal_kadaluarsa, kuitansi_url, catatan, status, created_by, tanggal_pembelian)
             VALUES (?, ?, ?, ?, ?, ?, 'disetujui', ?, ?)`,
            [reagen_id, batch, jumlah_botol, tanggal_kadaluarsa || null, kuitansi_url || '', catatan || '', username, tanggal_pembelian || null]
        );

        // Upsert batch stock (satu reagen + satu no_batch/expiry diakumulasi)
        const [existing] = await conn.query(
            `SELECT id FROM reagen_batch WHERE reagen_id=? AND no_batch=?`,
            [reagen_id, batch]
        );
        if (existing.length > 0) {
            await conn.query(
                `UPDATE reagen_batch SET stok_botol = stok_botol + ?, tanggal_kadaluarsa = COALESCE(?, tanggal_kadaluarsa) WHERE id=?`,
                [jumlah_botol, tanggal_kadaluarsa || null, existing[0].id]
            );
        } else {
            await conn.query(
                `INSERT INTO reagen_batch (reagen_id, no_batch, tanggal_kadaluarsa, stok_botol) VALUES (?, ?, ?, ?)`,
                [reagen_id, batch, tanggal_kadaluarsa || null, jumlah_botol]
            );
        }

        // Tambah saldo botol master
        await conn.query('UPDATE reagen SET saldo_botol = saldo_botol + ? WHERE id=?', [jumlah_botol, reagen_id]);

        await conn.commit();
        res.json({ success: true, message: 'Reagen masuk berhasil, stok gudang bertambah' });
    } catch (error) {
        await conn.rollback();
        console.error('Error create masuk reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat barang masuk', error: error.message });
    } finally {
        conn.release();
    }
});

// DELETE barang masuk gudang — hapus record & balikkan stok (Hanya admin_pemeliharaan)
router.delete('/reagen/masuk/:id', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin_pemeliharaan yang dapat menghapus barang masuk.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const [rows] = await conn.query('SELECT * FROM reagen_masuk WHERE id=?', [id]);
        if (rows.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Data barang masuk tidak ditemukan' });
        }
        const masuk = rows[0];

        // Balikkan stok batch (jangan sampai negatif)
        await conn.query(
            'UPDATE reagen_batch SET stok_botol = GREATEST(stok_botol - ?, 0) WHERE reagen_id=? AND no_batch=?',
            [masuk.jumlah_botol, masuk.reagen_id, masuk.no_batch]
        );
        // Hapus baris batch bila stoknya habis (tidak ada FK dari pengeluaran/lab_stok)
        await conn.query(
            'DELETE FROM reagen_batch WHERE reagen_id=? AND no_batch=? AND stok_botol <= 0',
            [masuk.reagen_id, masuk.no_batch]
        );

        // Balikkan saldo botol master
        await conn.query(
            'UPDATE reagen SET saldo_botol = GREATEST(saldo_botol - ?, 0) WHERE id=?',
            [masuk.jumlah_botol, masuk.reagen_id]
        );

        await conn.query('DELETE FROM reagen_masuk WHERE id=?', [id]);

        await conn.commit();
        res.json({ success: true, message: 'Barang masuk reagen berhasil dihapus, stok dikembalikan' });
    } catch (error) {
        await conn.rollback();
        console.error('Error delete masuk reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus barang masuk', error: error.message });
    } finally {
        conn.release();
    }
});

// ========== PENGELUARAN GUDANG KE LAB ==========
// Alur (sama seperti ATK):
//   PIC Lab ajukan (draft) -> kirim ke Katim -> disetujui Katim -> disetujui Kabag TU -> diserahkan PIC Gudang

// GET pengeluaran (grouped by group_id)
// Data dibatasi per role & identitas (sama seperti ATK):
//  - PIC Lab         : hanya pengeluaran miliknya sendiri (requested_by)
//  - Katim           : hanya yang dikirim ke dirinya (katim_id)
//  - PIC Gudang / Kabag TU / Admin : melihat semua
router.get('/reagen/pengeluaran', keycloakAuth, async (req, res) => {
    try {
        const username = getUsername(req);
        const userId = req.user?.user_id || req.user?.id || req.user?.sub || '';

        const isAdmin = hasRole(req, ['admin', 'superadmin']);
        const isPicGudang = hasRole(req, ['pic_gudang']);
        const isKabagTu = hasRole(req, ['kabag_tu']);
        const isKatim = hasRole(req, ['katim']);

        let whereClause = ' WHERE 1=1';
        const params = [];
        if (!isAdmin && !isPicGudang && !isKabagTu) {
            if (isKatim) {
                // Katim hanya melihat pengeluaran yang dikirim ke dirinya
                whereClause += ' AND p.katim_id = ?';
                params.push(userId);
            } else {
                // PIC Lab (dan role lain): hanya pengeluaran miliknya sendiri
                whereClause += ' AND p.requested_by = ?';
                params.push(username);
            }
        }

        const [rows] = await db.query(`
            SELECT p.*, r.nama_barang, r.kategori, r.berat_volume, r.satuan,
                   b.tanggal_kadaluarsa, b.no_batch as batch_no_batch
            FROM reagen_pengeluaran p
            LEFT JOIN reagen r ON p.reagen_id = r.id
            LEFT JOIN reagen_batch b ON p.batch_id = b.id
            ${whereClause}
            ORDER BY p.created_at DESC
        `, params);

        const groups = {};
        for (const r of rows) {
            const gid = r.group_id || `sg-${r.id}`;
            if (!groups[gid]) {
                groups[gid] = {
                    group_id: gid,
                    requested_by: r.requested_by,
                    catatan: r.catatan,
                    status: r.status,
                    katim_id: r.katim_id,
                    katim_nama: r.katim_nama,
                    approved_katim_by: r.approved_katim_by,
                    approved_katim_at: r.approved_katim_at,
                    approved_kabag_by: r.approved_kabag_by,
                    approved_kabag_at: r.approved_kabag_at,
                    approved_by: r.approved_by,
                    approved_at: r.approved_at,
                    delivered_by: r.delivered_by,
                    delivered_at: r.delivered_at,
                    created_at: r.created_at,
                    items: []
                };
            }
            groups[gid].items.push({
                id: r.id,
                reagen_id: r.reagen_id,
                batch_id: r.batch_id,
                nama_barang: r.nama_barang,
                kategori: r.kategori,
                berat_volume: r.berat_volume,
                satuan: r.satuan,
                no_batch: r.no_batch,
                lab_tujuan: r.lab_tujuan || 'pangan',
                tanggal_kadaluarsa: r.tanggal_kadaluarsa,
                jumlah_botol: r.jumlah_botol,
                jumlah_diminta: r.jumlah_diminta,
                status: r.status
            });
        }

        // Derive group status
        for (const gid of Object.keys(groups)) {
            const group = groups[gid];
            const itemStatuses = group.items.map(i => i.status);
            const uniqueStatuses = [...new Set(itemStatuses)];
            if (uniqueStatuses.length > 1) {
                // Jika ada item yang sudah disetujui Kabag TU → grup dianggap selesai,
                // bukan lagi "menunggu persetujuan", walau ada item ditolak.
                if (itemStatuses.some(s => s === 'disetujui_kabag')) {
                    group.status = 'disetujui_kabag';
                } else {
                    group.status = 'diserahkan_sebagian';
                }
            }
        }

        res.json({ success: true, data: Object.values(groups), total: Object.keys(groups).length });
    } catch (error) {
        console.error('Error fetch pengeluaran reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data', error: error.message });
    }
});

// POST create pengeluaran (PIC Lab) — disimpan sebagai draft
router.post('/reagen/pengeluaran', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_lab', 'pic_persediaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya PIC Lab yang dapat request reagen.' });
    }
    try {
        const { items, catatan } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Minimal 1 item harus dipilih' });
        }
        const username = getUsername(req);
        const { v4: uuidv4 } = require('uuid');
        const groupId = uuidv4();

        // Validasi stok botol per reagen
        for (const item of items) {
            if (!item.reagen_id || !item.jumlah_botol) continue;
            const [reagen] = await db.query('SELECT saldo_botol, nama_barang FROM reagen WHERE id=?', [item.reagen_id]);
            if (reagen.length === 0) {
                return res.status(400).json({ success: false, message: `Reagen ID ${item.reagen_id} tidak ditemukan` });
            }
            const stok = Number(reagen[0].saldo_botol);
            if (Number(item.jumlah_botol) > stok) {
                return res.status(400).json({ success: false, message: `"${reagen[0].nama_barang}" stok gudang ${stok} botol, tidak mencukupi` });
            }
        }

        for (const item of items) {
            if (!item.reagen_id || !item.jumlah_botol) continue;
            await db.query(
                `INSERT INTO reagen_pengeluaran (group_id, reagen_id, batch_id, no_batch, lab_tujuan, jumlah_botol, jumlah_diminta, catatan, status, requested_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
                [groupId, item.reagen_id, item.batch_id || null, item.no_batch || '', getLabTujuan(item.lab_tujuan), item.jumlah_botol, item.jumlah_botol, item.catatan || catatan || '', username]
            );
        }
        res.json({ success: true, data: { group_id: groupId }, message: 'Pengeluaran reagen ke Lab disimpan sebagai draft' });
    } catch (error) {
        console.error('Error create pengeluaran reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal membuat pengeluaran', error: error.message });
    }
});

// PUT kirim ke Katim (PIC Lab) — pilih katim, status -> menunggu_katim
router.put('/reagen/pengeluaran/:groupId/kirim-ke-katim', keycloakAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { katim_id, katim_nama } = req.body;
        if (!katim_id) return res.status(400).json({ success: false, message: 'Pilih Katim terlebih dahulu' });

        const [items] = await db.query('SELECT COUNT(*) as cnt FROM reagen_pengeluaran WHERE group_id=?', [groupId]);
        if (items.length === 0 || items[0].cnt === 0) {
            return res.status(404).json({ success: false, message: 'Group pengeluaran tidak ditemukan' });
        }

        await db.query(
            `UPDATE reagen_pengeluaran SET katim_id=?, katim_nama=?, status="menunggu_katim"
             WHERE group_id=? AND (status="draft" OR status="diajukan")`,
            [katim_id, katim_nama || '', groupId]
        );
        await createNotif(katim_id, 'katim', 'Pengeluaran Reagen Baru',
            `Ada pengeluaran reagen dari ${getUsername(req)} yang perlu disetujui`, '/persediaan/reagen');
        // Notif ke Kabag TU & PIC Persediaan (permohonan masuk)
        await createNotif('', 'kabag_tu', 'Permohonan Reagen Masuk',
            `Ada permohonan reagen baru dari ${getUsername(req)} yang menunggu persetujuan`, '/persediaan/reagen');
        await createNotif('', 'pic_persediaan', 'Permohonan Reagen Masuk',
            `Permohonan reagen telah dikirim ke Katim untuk disetujui`, '/persediaan/reagen');
        res.json({ success: true, message: `Pengeluaran dikirim ke ${katim_nama || 'Katim'}` });
    } catch (error) {
        console.error('Error kirim ke katim:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// PUT approve katim (Katim) — status -> disetujui_katim
router.put('/reagen/pengeluaran/:groupId/approve-katim', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['katim', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya katim yang dapat approve.' });
    }
    try {
        const { groupId } = req.params;
        const username = getUsername(req);
        await db.query(
            `UPDATE reagen_pengeluaran SET status="disetujui_katim", approved_katim_by=?, approved_katim_at=NOW()
             WHERE group_id=? AND (status="diajukan" OR status="menunggu_katim")`,
            [username, groupId]
        );
        await createNotif('', 'pic_gudang', 'Pengeluaran Disetujui Katim',
            `Pengeluaran reagen telah disetujui Katim, menunggu verifikasi & penyerahan PIC Gudang`, '/persediaan/reagen');
        res.json({ success: true, message: 'Disetujui Katim, menunggu verifikasi PIC Gudang' });
    } catch (error) {
        console.error('Error approve katim:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// PUT approve kabag (Kabag TU) — status -> disetujui_kabag
router.put('/reagen/pengeluaran/:groupId/approve-kabag', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['kabag_tu', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya kabag_tu yang dapat approve.' });
    }
    try {
        const { groupId } = req.params;
        const username = getUsername(req);
        await db.query(
            `UPDATE reagen_pengeluaran SET status="disetujui_kabag", approved_kabag_by=?, approved_kabag_at=NOW()
             WHERE group_id=? AND (status="diserahkan" OR status="diserahkan_sebagian")`,
            [username, groupId]
        );
        await createNotif('', 'pic_lab', 'Permohonan Reagen Selesai',
            `Permohonan reagen telah disetujui Kabag TU dan dinyatakan selesai`, '/persediaan/reagen');
        res.json({ success: true, message: 'Disetujui Kabag TU, permohonan selesai' });
    } catch (error) {
        console.error('Error approve kabag:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// PUT serahkan pengeluaran (PIC Gudang) — kurangi stok batch/botol, tambah stok LAB per gram
router.put('/reagen/pengeluaran/:groupId/serahkan', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang yang dapat menyerahkan.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { groupId } = req.params;
        const username = getUsername(req);

        const [items] = await conn.query(
            `SELECT p.*, r.berat_volume, r.satuan, b.tanggal_kadaluarsa, b.stok_botol as stok_batch
             FROM reagen_pengeluaran p
             LEFT JOIN reagen r ON p.reagen_id = r.id
             LEFT JOIN reagen_batch b ON p.batch_id = b.id
             WHERE p.group_id=? AND p.status='disetujui_katim'`,
            [groupId]
        );
        if (items.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Tidak ada item yang menunggu penyerahan (harus sudah disetujui Katim)' });
        }

        let serahCount = 0;
        const today = new Date().toISOString().split('T')[0];

        for (const item of items) {
            const jml = Number(item.jumlah_botol) || 0;
            // Kurangi stok batch jika ada batch_id
            if (item.batch_id) {
                const [batch] = await conn.query('SELECT stok_botol FROM reagen_batch WHERE id=?', [item.batch_id]);
                if (batch.length === 0) continue;
                const sisaBatch = Number(batch[0].stok_botol) - jml;
                if (sisaBatch < 0) continue;
                await conn.query('UPDATE reagen_batch SET stok_botol=? WHERE id=?', [sisaBatch, item.batch_id]);
            }
            // Kurangi saldo botol master
            await conn.query('UPDATE reagen SET saldo_botol = GREATEST(saldo_botol - ?, 0) WHERE id=?', [jml, item.reagen_id]);

            // Update status pengeluaran
            await conn.query(
                'UPDATE reagen_pengeluaran SET status="diserahkan", delivered_by=?, delivered_at=NOW() WHERE id=?',
                [username, item.id]
            );

            // Tambah stok LAB per gram/mL (setiap botol jadi 1 baris stok lab)
            const { qty, unit } = parseBerat(item.berat_volume);
            const labTujuan = getLabTujuan(item.lab_tujuan);
            for (let i = 0; i < jml; i++) {
                await conn.query(
                    `INSERT INTO reagen_lab_stok (reagen_id, batch_id, asal_pengeluaran_id, lab_tujuan, berat_awal, sisa_berat, satuan_lab, tanggal_masuk_lab)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [item.reagen_id, item.batch_id, item.id, labTujuan, qty, qty, unit, today]
                );
            }
            serahCount++;
        }

        await conn.commit();
        if (serahCount > 0) {
            await createNotif('', 'kabag_tu', 'Reagen Telah Diserahkan',
                `Reagen telah diserahkan ke LAB oleh PIC Gudang, menunggu persetujuan akhir Kabag TU`, '/persediaan/reagen');
        }
        res.json({ success: true, message: `${serahCount} item diserahkan ke LAB, stok gudang berkurang & persediaan LAB bertambah` });
    } catch (error) {
        await conn.rollback();
        console.error('Error serahkan pengeluaran reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal menyerahkan', error: error.message });
    } finally {
        conn.release();
    }
});

// PUT tolak pengeluaran
router.put('/reagen/pengeluaran/:groupId/tolak', keycloakAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { alasan } = req.body;
        const username = getUsername(req);
        await db.query(
            `UPDATE reagen_pengeluaran SET status="ditolak", catatan=CONCAT(IFNULL(catatan,""), ?)
             WHERE group_id=? AND status NOT IN ("diserahkan","ditolak")`,
            [` | Ditolak oleh ${username}: ${alasan || ''}`, groupId]
        );
        res.json({ success: true, message: `Pengeluaran ditolak${alasan ? ': ' + alasan : ''}` });
    } catch (error) {
        console.error('Error tolak pengeluaran reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// DELETE pengeluaran (hanya draft)
router.delete('/reagen/pengeluaran/:groupId', keycloakAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const [rows] = await db.query('SELECT status FROM reagen_pengeluaran WHERE group_id=?', [groupId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        const allDraft = rows.every(r => r.status === 'draft' || r.status === 'diajukan');
        if (!allDraft) return res.status(400).json({ success: false, message: 'Hanya pengeluaran draft/diajukan yang bisa dihapus' });
        await db.query('DELETE FROM reagen_pengeluaran WHERE group_id=?', [groupId]);
        res.json({ success: true, message: 'Pengeluaran dihapus' });
    } catch (error) {
        console.error('Error delete pengeluaran reagen:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// ========== STOK LAB (per gram/mL) & PEMAKAIAN ==========

// GET stok lab (per botol diterima, sisa per gram/mL)
router.get('/reagen/lab-stok', keycloakAuth, async (req, res) => {
    try {
        const { kategori, search, reagen_id, lab_tujuan } = req.query;
        // Hanya tampilkan persediaan lab yang pengeluarannya SUDAH disetujui Kabag TU
        // (walaupun reagen sudah diserahkan PIC Gudang, belum tampil sebelum disetujui kabag)
        let whereClause = ' WHERE 1=1 AND p.status = \'disetujui_kabag\'';
        const params = [];
        if (reagen_id) { whereClause += ' AND l.reagen_id = ?'; params.push(reagen_id); }
        if (kategori) { whereClause += ' AND r.kategori = ?'; params.push(kategori); }
        if (lab_tujuan) { whereClause += ' AND l.lab_tujuan = ?'; params.push(lab_tujuan); }
        if (search) {
            whereClause += ' AND (r.nama_barang LIKE ? OR r.kode_barang LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }

        const [rows] = await db.query(
            `SELECT l.*, r.nama_barang, r.kategori, r.kode_barang, r.berat_volume,
                    b.no_batch, b.tanggal_kadaluarsa
             FROM reagen_lab_stok l
             LEFT JOIN reagen r ON l.reagen_id = r.id
             LEFT JOIN reagen_batch b ON l.batch_id = b.id
             LEFT JOIN reagen_pengeluaran p ON l.asal_pengeluaran_id = p.id
             ${whereClause}
             ORDER BY r.kategori ASC, r.nama_barang ASC, l.tanggal_masuk_lab ASC`,
            params
        );
        res.json({ success: true, data: rows, total: rows.length });
    } catch (error) {
        console.error('Error fetch lab stok:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil persediaan lab', error: error.message });
    }
});

// POST pemakaian lab (keluar per gram/mL)
router.post('/reagen/lab-pemakaian', keycloakAuth, async (req, res) => {
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { lab_stok_id, jumlah, tanggal, catatan } = req.body;
        if (!lab_stok_id || !jumlah || Number(jumlah) <= 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Persediaan lab dan jumlah pemakaian wajib diisi' });
        }
        const username = getUsername(req);

        const [rows] = await conn.query('SELECT * FROM reagen_lab_stok WHERE id=?', [lab_stok_id]);
        if (rows.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Persediaan lab tidak ditemukan' });
        }
        const stok = rows[0];
        const sisa = Number(stok.sisa_berat);
        const pakai = Number(jumlah);
        if (pakai > sisa) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: `Sisa persediaan lab hanya ${sisa} ${stok.satuan_lab}, tidak cukup untuk pemakaian ${pakai}` });
        }

        await conn.query(
            `INSERT INTO reagen_lab_pemakaian (lab_stok_id, jumlah, tanggal, catatan, created_by) VALUES (?, ?, ?, ?, ?)`,
            [lab_stok_id, pakai, tanggal || new Date().toISOString().split('T')[0], catatan || '', username]
        );
        await conn.query('UPDATE reagen_lab_stok SET sisa_berat = sisa_berat - ? WHERE id=?', [pakai, lab_stok_id]);

        await conn.commit();
        res.json({ success: true, message: `Pemakaian ${pakai} ${stok.satuan_lab} dicatat di LAB` });
    } catch (error) {
        await conn.rollback();
        console.error('Error pemakaian lab:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat pemakaian lab', error: error.message });
    } finally {
        conn.release();
    }
});

// GET riwayat pemakaian lab
router.get('/reagen/lab-pemakaian', keycloakAuth, async (req, res) => {
    try {
        const { reagen_id, lab_tujuan } = req.query;
        // Hanya tampilkan pemakaian yang pengeluarannya SUDAH disetujui Kabag TU
        let whereClause = ' WHERE 1=1 AND pe.status = \'disetujui_kabag\'';
        const params = [];
        if (reagen_id) {
            whereClause += ' AND r.id = ?';
            params.push(reagen_id);
        }
        if (lab_tujuan) {
            whereClause += ' AND l.lab_tujuan = ?';
            params.push(lab_tujuan);
        }
        const [rows] = await db.query(
            `SELECT p.*, l.satuan_lab, l.sisa_berat, l.lab_tujuan, r.nama_barang, r.kategori,
                    b.no_batch, b.tanggal_kadaluarsa
             FROM reagen_lab_pemakaian p
             LEFT JOIN reagen_lab_stok l ON p.lab_stok_id = l.id
             LEFT JOIN reagen r ON l.reagen_id = r.id
             LEFT JOIN reagen_batch b ON l.batch_id = b.id
             LEFT JOIN reagen_pengeluaran pe ON l.asal_pengeluaran_id = pe.id
             ${whereClause}
             ORDER BY p.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows, total: rows.length });
    } catch (error) {
        console.error('Error fetch pemakaian lab:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat pemakaian', error: error.message });
    }
});

module.exports = router;
