const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');

// GET — ambil notifikasi untuk user yang login
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const roles = req.user?.roles || [];
        if (!userId && roles.length === 0) return res.json({ success: true, data: [], unread: 0 });

        let query = 'SELECT * FROM notifications WHERE (user_id = ?';
        const params = [userId];

        // Juga ambil notifikasi berdasarkan role
        for (const role of roles) {
            query += ' OR user_role = ?';
            params.push(role);
        }
        query += ') ORDER BY created_at DESC LIMIT 50';

        const [rows] = await db.query(query, params);
        const unread = rows.filter(r => !r.is_read).length;

        res.json({ success: true, data: rows, unread });
    } catch (error) {
        console.error('Error fetch notifications:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// PUT — tandai sudah dibaca
router.put('/:id/read', keycloakAuth, async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read=1 WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error mark read:', error);
        res.status(500).json({ success: false });
    }
});

// PUT — tandai semua sudah dibaca
router.put('/read-all', keycloakAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const roles = req.user?.roles || [];
        let query = 'UPDATE notifications SET is_read=1 WHERE (user_id = ?';
        const params = [userId];
        for (const role of roles) { query += ' OR user_role = ?'; params.push(role); }
        query += ')';
        await db.query(query, params);
        res.json({ success: true });
    } catch (error) {
        console.error('Error mark all read:', error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
