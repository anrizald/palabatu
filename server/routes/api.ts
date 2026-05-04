import { Router } from 'express';
import { pool } from '../db/client';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/problems', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, name, grade, location AS location_name, lat AS latitude, lng AS longitude FROM problems'
        );
        res.json(rows);
    } catch (err) {
        console.error('Problems error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/profiles/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.json(null);
        res.json({
            ...rows[0],
            tags: typeof rows[0].tags === 'string' ? JSON.parse(rows[0].tags) : rows[0].tags
        });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/profiles/:id', requireAuth, async (req, res) => {
    const { username, title, tags, avatar_url } = req.body;
    try {
        const { rows } = await pool.query(
            `INSERT INTO profiles (id, username, title, tags, avatar_url)
             VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET username = $2, title = $3, tags = $4, avatar_url = $5
            RETURNING *`,
            [req.params.id, username, JSON.stringify(title), JSON.stringify(tags), avatar_url]

        );
        res.json({
            ...rows[0],
            tags: typeof rows[0].tags === 'string' ? JSON.parse(rows[0].tags) : rows[0].tags
        });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/problems', requireAuth, async (req, res) => {
    const { name, grade, location, lat, lng } = req.body;
    const userId = (req as any).user.id;
    try {
        const { rows } = await pool.query(
            `INSERT INTO problems (name, grade, location, lat, lng, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING 
             id, name, grade, location AS location_name, lat AS latitude, lng AS longitude`,
            [name, grade, location, lat, lng, userId]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('Problem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;