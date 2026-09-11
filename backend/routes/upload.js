// backend/routes/upload.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { keycloakAuth } = require('../middleware/keycloakAuth');

// Pastikan folder uploads ada
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `foto-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB per file
    },
    fileFilter: (req, file, cb) => {
        // Hanya izinkan file gambar
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan'));
        }
    }
});

// backend/routes/upload.js

// Pastikan di response menggunakan endpoint publik
router.post('/foto', keycloakAuth, upload.array('foto_kerusakan', 10), (req, res) => {
    try {
        const files = req.files;
        
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada file yang diupload'
            });
        }
        
        // Buat array URL file - GUNAKAN ENDPOINT PUBLIK
        const fileUrls = files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            url: `/uploads/${file.filename}`, // Gunakan endpoint publik, BUKAN /api/uploads/
            path: file.path
        }));
        
        console.log(`✅ ${files.length} file berhasil diupload oleh ${req.user?.username}`);
        
        res.json({
            success: true,
            message: `${files.length} file berhasil diupload`,
            data: fileUrls
        });
        
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal upload file',
            error: error.message
        });
    }
});

// Endpoint untuk single file upload
router.post('/foto/single', keycloakAuth, upload.single('foto'), (req, res) => {
    try {
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada file yang diupload'
            });
        }
        
        res.json({
            success: true,
            message: 'File berhasil diupload',
            data: {
                filename: file.filename,
                originalName: file.originalname,
                size: file.size,
                url: `/uploads/${file.filename}`, // Gunakan endpoint publik
                path: file.path
            }
        });
        
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal upload file',
            error: error.message
        });
    }
});

// Endpoint untuk delete file
router.delete('/foto/:filename', keycloakAuth, (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(uploadDir, filename);
        
        // Cek apakah file ada
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File tidak ditemukan'
            });
        }
        
        // Hapus file
        fs.unlinkSync(filePath);
        
        console.log(`✅ File ${filename} berhasil dihapus oleh ${req.user?.username}`);
        
        res.json({
            success: true,
            message: 'File berhasil dihapus'
        });
        
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus file',
            error: error.message
        });
    }
});

module.exports = router;