// backend/utils/uploadsDir.js
// Satu sumber kebenaran folder upload.
//
// Sebelumnya upload disimpan ke <backend>/uploads sementara endpoint /uploads
// membaca process.env.UPLOADS_PATH (/data/uploads di docker-compose), jadi file
// yang berhasil diupload tidak bisa dibuka/di-merge ("File not found").
//
// Aturan sekarang:
//  - semua penulisan & pembacaan memakai UPLOADS_DIR (UPLOADS_PATH bila di-set)
//  - folder lama <backend>/uploads tetap dibaca sebagai fallback, supaya file
//    yang sudah terlanjur tersimpan di sana sebelum perbaikan ini tetap bisa
//    dibuka tanpa perlu migrasi manual.
const fs = require('fs');
const path = require('path');

const LEGACY_UPLOADS_DIR = path.resolve(path.join(__dirname, '..', 'uploads'));
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_PATH || LEGACY_UPLOADS_DIR);

const CANDIDATE_DIRS = UPLOADS_DIR === LEGACY_UPLOADS_DIR ? [UPLOADS_DIR] : [UPLOADS_DIR, LEGACY_UPLOADS_DIR];

const ensureUploadsDir = () => {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    return UPLOADS_DIR;
};

// Hanya nama file polos yang diterima: cegah path traversal ('../', '..\', dsb).
const sanitizeFileName = (name) => {
    const base = path.basename(String(name || ''));
    if (!base || base === '.' || base === '..' || base.includes('..')) return '';
    return base;
};

// Cari file di folder aktif, lalu di folder lama. Null bila tidak ada di keduanya.
const findUpload = (filename) => {
    const base = sanitizeFileName(filename);
    if (!base) return null;
    for (const dir of CANDIDATE_DIRS) {
        const filePath = path.join(dir, base);
        if (fs.existsSync(filePath)) return filePath;
    }
    return null;
};

module.exports = {
    UPLOADS_DIR,
    LEGACY_UPLOADS_DIR,
    CANDIDATE_DIRS,
    ensureUploadsDir,
    sanitizeFileName,
    findUpload
};
