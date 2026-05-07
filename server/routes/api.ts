import multer from 'multer';
import { Router } from 'express';
import { pool } from '../db/client';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../middleware/auth';

const router = Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const upload = multer({ storage: multer.memoryStorage() });

router.get('/problems', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                p.id, 
                p.name, 
                p.grade, 
                p.location AS location_name, 
                p.lat AS latitude, 
                p.lng AS longitude, 
                p.created_by,
                pr.username AS creator_name
            FROM problems p
            LEFT JOIN profiles pr ON p.created_by = pr.id
        `);
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

router.post('/upload/avatar', requireAuth, upload.single('avatar'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Upload to Cloudinary via stream
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'kepalabatu_avatars' },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary error:', error);
                    return res.status(500).json({ error: 'Cloudinary upload failed' });
                }
                // Send the secure URL back to the frontend
                res.json({ avatar_url: result?.secure_url });
            }
        );

        // Pipe the multer memory buffer into the Cloudinary stream
        uploadStream.end(req.file.buffer);
    } catch (err) {
        console.error('Upload route error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/problems/:id', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const result = await pool.query(
            'DELETE FROM problems WHERE id = $1 AND created_by = $2 RETURNING id',
            [req.params.id, userId]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Not authorized or not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/problems/:id', requireAuth, async (req, res) => {
    const { name, grade } = req.body; // Add location/lat/lng if you want them to be editable too!
    const userId = (req as any).user.id;
    try {
        const result = await pool.query(
            `UPDATE problems SET name = $1, grade = $2 
             WHERE id = $3 AND created_by = $4 RETURNING *`,
            [name, grade, req.params.id, userId]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Not authorized or not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;