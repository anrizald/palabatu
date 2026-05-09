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
                p.image_urls,
                pr.username AS creator_name,
            COALESCE((SELECT COUNT(*) FROM sends WHERE problem_id = p.id), 0)::int AS send_count
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
    const userId = (req as any).user.id;
    const titles = await getUserTitles(userId);

    if (!titles.includes('Council') && !titles.includes('Founder')) {
        return res.status(403).json({ error: 'Only users with the title "Council" or "Founder" can add problems' });
    }

    const { name, grade, location, lat, lng, image_urls } = req.body;
    try {
        const { rows } = await pool.query(
            `INSERT INTO problems (name, grade, location, lat, lng, created_by, image_urls)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING 
             id, name, grade, location AS location_name, lat AS latitude, lng AS longitude`,
            [name, grade, location, lat, lng, userId, JSON.stringify(image_urls || [])]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('Problem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/upload/topo', requireAuth, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'kepalabatu_topos' }, // Separate folder so it stays organized!
            (error, result) => {
                if (error) {
                    console.error('Cloudinary error:', error);
                    return res.status(500).json({ error: 'Cloudinary upload failed' });
                }
                // Notice we return { url: ... } because our frontend expects "url"
                res.json({ url: result?.secure_url });
            }
        );

        uploadStream.end(req.file.buffer);
    } catch (err) {
        console.error('Upload route error:', err);
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
    const titles = await getUserTitles(userId);

    try {
        const prob = await pool.query('SELECT created_by, image_urls FROM problems WHERE id = $1', [req.params.id]);
        if (prob.rowCount === 0) return res.status(404).json({ error: 'Not found' });

        const isCreator = prob.rows[0].created_by === userId;
        const isCouncil = titles.includes('Council');

        if (!isCreator && !isCouncil) {
            return res.status(403).json({ error: 'Not authorized to delete this problem.' });
        }

        const imageUrls = prob.rows[0].image_urls;
        const urlsArray = typeof imageUrls === 'string' ? JSON.parse(imageUrls) : (imageUrls || []);
        for (const url of urlsArray) {
            try {
                const parts = url.split('/upload/');
                if (parts.length > 1) {
                    let publicId = parts[1].replace(/^v\d+\//, '');
                    // Remove the file extension (e.g., .jpg)
                    publicId = publicId.substring(0, publicId.lastIndexOf('.'));

                    // Tell Cloudinary to destroy it!
                    await cloudinary.uploader.destroy(publicId);
                }
            } catch (e) {
                console.error('Failed to delete image from Cloudinary:', e);
            }
        }

        await pool.query('DELETE FROM problems WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/problems/:id', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const titles = await getUserTitles(userId);
    const { name, grade } = req.body; // Add location/lat/lng if you want them to be editable too!

    try {
        const prob = await pool.query('SELECT created_by FROM problems WHERE id = $1', [req.params.id]);
        if (prob.rowCount === 0) return res.status(404).json({ error: 'Not found' });

        const isCreator = prob.rows[0].created_by === userId;
        const isCouncil = titles.includes('Council');

        if (!isCreator && !isCouncil) {
            return res.status(403).json({ error: 'Not authorized to edit this problem.' });
        }

        const result = await pool.query(
            `UPDATE problems SET name = $1, grade = $2 WHERE id = $3 RETURNING *`,
            [name, grade, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Check if the logged-in user has sent this problem
router.get('/problems/:id/send-status', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const { rowCount } = await pool.query(
            'SELECT 1 FROM sends WHERE problem_id = $1 AND user_id = $2',
            [req.params.id, userId]
        );
        res.json({ hasSent: rowCount! > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Toggle the send (Add or Remove)
router.post('/problems/:id/send', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const problemId = req.params.id;

    try {
        // Check if it already exists
        const exist = await pool.query(
            'SELECT id FROM sends WHERE problem_id = $1 AND user_id = $2',
            [problemId, userId]
        );

        if (exist.rowCount! > 0) {
            // If they already sent it, clicking again "Un-sends" it
            await pool.query('DELETE FROM sends WHERE problem_id = $1 AND user_id = $2', [problemId, userId]);
            res.json({ action: 'removed' });
        } else {
            // Otherwise, log the send!
            await pool.query('INSERT INTO sends (problem_id, user_id) VALUES ($1, $2)', [problemId, userId]);
            res.json({ action: 'added' });
        }
    } catch (err) {
        console.error('Send error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- COMMENTS ---
router.get('/problems/:id/comments', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT c.id, c.content, c.created_at, p.username 
            FROM comments c
            JOIN profiles p ON c.user_id = p.id
            WHERE c.problem_id = $1
            ORDER BY c.created_at ASC
        `, [req.params.id]);

        res.json(rows);
    } catch (err) {
        console.error('Fetch comments error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Add a new comment
router.post('/problems/:id/comments', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    try {
        // We use a CTE (WITH clause) to insert the comment AND grab the user's username in one step
        const { rows } = await pool.query(`
            WITH new_comment AS (
                INSERT INTO comments (problem_id, user_id, content) 
                VALUES ($1, $2, $3) 
                RETURNING *
            )
            SELECT c.*, p.username 
            FROM new_comment c
            JOIN profiles p ON c.user_id = p.id;
        `, [req.params.id, userId, content]);

        res.json(rows[0]);
    } catch (err) {
        console.error('Post comment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- HELPER FUNCTIONS ---
async function getUserTitles(userId: string) {
    const { rows } = await pool.query('SELECT title FROM profiles WHERE id = $1', [userId]);
    if (!rows[0] || !rows[0].title) return [];
    try {
        return typeof rows[0].title === 'string' ? JSON.parse(rows[0].title) : rows[0].title;
    } catch (e) {
        return [];
    }
}

export default router;