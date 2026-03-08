import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client';

const router = Router();

router.post('/signup', async (req, res) => {
    const { email, password, username } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            'INSERT INTO users (email, password, username) VALUES ($1, $2, $3) RETURNING id, email, username',
            [email, hashed, username]
        );
        const token = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
        res.json({ user: rows[0], token });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(400).json({ error: 'Email2 already exists' });
    }
});

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (!rows[0]) return res.status(400).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, rows[0].password);
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
        res.json({ user: { id: rows[0].id, email, username: rows[0].username }, token });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/session', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const { rows } = await pool.query('SELECT id, email, username FROM users WHERE id = $1', [decoded.id]);
        res.json({ user: rows[0] });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;