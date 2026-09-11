// backend/utils/xlsxImport.js
// Helper bersama untuk import XLSX (dipakai modul aset, ruangan, dan asetRuangan).

let XLSX = null;
try { XLSX = require('xlsx-js-style'); } catch (e) {
    try { XLSX = require('xlsx'); } catch (e2) { console.log('⚠️ xlsx not installed, import disabled'); }
}

/**
 * Ubah nilai apa pun menjadi string yang sudah di-trim.
 */
const normalizeStr = (v) => String(v == null ? '' : v).trim();

/**
 * Tanggal hari ini (waktu lokal) dalam format YYYY-MM-DD.
 */
const todayLocalStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Normalisasi tanggal dari Excel -> 'YYYY-MM-DD'.
 * Mendukung: objek Date, teks YYYY-MM-DD, dd/mm/yyyy, dd-mm-yyyy, dan serial Excel.
 * @returns {string|null}
 */
const parseExcelDate = (value) => {
    if (value instanceof Date && !isNaN(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const raw = normalizeStr(value);
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(raw)) {
        const p = raw.split('/');
        return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}/.test(raw)) {
        const p = raw.split('-');
        return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
    const serial = parseFloat(raw);
    if (!isNaN(serial) && serial > 20000) {
        const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
        return d.toISOString().slice(0, 10);
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
    return null;
};

/**
 * Cek apakah baris merupakan baris catatan/keterangan pada template.
 */
const looksLikeNote = (firstCell) => /^[-•]/.test(firstCell) || /^keterangan/i.test(firstCell);

/**
 * Normalisasi nama header: lowercase + hanya alfanumerik.
 * Contoh: 'Jenis BMN' -> 'jenisbmn', 'jenis_bmn' -> 'jenisbmn'.
 */
const normalizeHeader = (h) => normalizeStr(h).toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Baca worksheet menjadi baris-baris dengan KUNCI KANONIK, toleran terhadap
 * perbedaan nama header (mis. hasil Export memakai label 'Jenis BMN',
 * sedangkan template memakai 'jenis_bmn').
 * @param {object} ws worksheet
 * @param {Object<string, string[]>} aliasMap - { kunciKanonik: [alias, ...] }
 * @returns {{ rows: object[], matched: string[], headers: string[] }}
 */
function readRowsWithAliases(ws, aliasMap) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    if (!aoa || aoa.length === 0) return { rows: [], matched: [], headers: [] };

    const headerRow = aoa[0] || [];
    const colToKey = {};
    const usedKeys = new Set();

    headerRow.forEach((h, idx) => {
        const norm = normalizeHeader(h);
        if (!norm) return;
        for (const key of Object.keys(aliasMap)) {
            if (usedKeys.has(key)) continue;
            const aliases = aliasMap[key] || [];
            if (aliases.some(a => normalizeHeader(a) === norm)) {
                colToKey[idx] = key;
                usedKeys.add(key);
                break;
            }
        }
    });

    const rows = [];
    for (let r = 1; r < aoa.length; r++) {
        const raw = aoa[r] || [];
        const obj = {};
        let hasValue = false;
        Object.keys(colToKey).forEach((idx) => {
            const key = colToKey[idx];
            const val = raw[idx] !== undefined && raw[idx] !== null ? raw[idx] : '';
            obj[key] = val;
            if (normalizeStr(val) !== '') hasValue = true;
        });
        if (hasValue) rows.push(obj);
    }

    return { rows, matched: [...usedKeys], headers: headerRow.map(h => normalizeStr(h)) };
}

module.exports = {
    XLSX,
    normalizeStr,
    todayLocalStr,
    parseExcelDate,
    looksLikeNote,
    normalizeHeader,
    readRowsWithAliases,
};
