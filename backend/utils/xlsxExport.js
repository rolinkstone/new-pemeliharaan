// backend/utils/xlsxExport.js
// Helper bersama untuk export XLSX (dipakai modul aset, ruangan, dan asetRuangan).

const { XLSX, normalizeStr } = require('./xlsxImport');

const HEADER_STYLE = {
    fill: { fgColor: { rgb: 'D6E4F0' } },
    font: { bold: true, sz: 10, color: { rgb: '1F4E79' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
        top: { style: 'thin', color: { rgb: '1F4E79' } },
        bottom: { style: 'thin', color: { rgb: '1F4E79' } },
        left: { style: 'thin', color: { rgb: '1F4E79' } },
        right: { style: 'thin', color: { rgb: '1F4E79' } },
    },
};

const border = {
    top: { style: 'thin', color: { rgb: 'D0D0D0' } },
    bottom: { style: 'thin', color: { rgb: 'D0D0D0' } },
    left: { style: 'thin', color: { rgb: 'D0D0D0' } },
    right: { style: 'thin', color: { rgb: 'D0D0D0' } },
};

/**
 * Buat worksheet dari array-of-arrays dengan styling header & border.
 * Kolom pertama ("No") dibuat center, sisanya left.
 * @param {Array<Array<any>>} aoa - termasuk baris header di index 0
 * @param {Array<{wch:number}>} [colWidths]
 */
function buildXlsxSheet(aoa, colWidths) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (colWidths) ws['!cols'] = colWidths;

    const header = aoa[0] || [];
    for (let c = 0; c < header.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: header[c] ?? '' };
        ws[ref].s = HEADER_STYLE;
    }

    for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r] || [];
        for (let c = 0; c < row.length; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { t: 's', v: row[c] ?? '' };
            ws[ref].s = {
                border,
                alignment: { horizontal: c === 0 ? 'center' : 'left', vertical: 'center' },
            };
        }
    }

    return ws;
}

/**
 * Kirim workbook XLSX sebagai attachment.
 */
function sendWorkbook(res, wb, filename) {
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buf);
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Format tanggal -> 'YYYY-MM-DD'.
 */
function formatDateCell(v) {
    if (!v) return '';
    const s = normalizeStr(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(v);
    if (isNaN(d.getTime())) return s;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Format tanggal+waktu -> 'YYYY-MM-DD HH:mm:ss'.
 */
function formatDateTimeCell(v) {
    if (!v) return '';
    const s = normalizeStr(v);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19);
    const d = new Date(v);
    if (isNaN(d.getTime())) return s;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Stempel tanggal untuk nama file (YYYY-MM-DD).
 */
function todayFileStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = {
    buildXlsxSheet,
    sendWorkbook,
    formatDateCell,
    formatDateTimeCell,
    todayFileStamp,
};
