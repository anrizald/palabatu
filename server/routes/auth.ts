import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client';
import crypto from 'crypto';
import { sendVerificationEmail } from '../lib/mailer';
import { P } from 'framer-motion/dist/types.d-Cjd591yU';

const router = Router();

router.post('/signup', async (req, res) => {
    const { email, password, username } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const { rows } = await pool.query(
            `INSERT INTO users (email, password, username, verification_token, is_verified)
             VALUES($1, $2, $3, $4, false)
             RETURNING id, email, username`,
            [email, hashed, username, verificationToken]
        );
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (err) {
            // rollback user if email fails
            await pool.query('DELETE FROM users WHERE id = $1', [rows[0].id]);
            console.error('EMAIL ERROR:', err);
            return res.status(500).json({ error: 'Failed to send verification email' });
        }

        // res.json({ user: rows[0], token });
        res.json({ message: 'Signup successful, check your email for verification' });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(400).json({ error: 'Email already exists' });
    }
});

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (!rows[0]) return res.status(400).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, rows[0].password);
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

        if (!rows[0].is_verified) return res.status(400).json({ error: 'Email registered but not verified' });

        const token = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
        res.json({ user: { id: rows[0].id, email, username: rows[0].username }, token });
    } catch (err) {
        console.error('SIGNIN ERROR:', err);
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

router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    try {
        const { rows } = await pool.query(
            `UPDATE users SET is_verified = TRUE, verification_token = NULL
             WHERE verification_token = $1
             RETURNING id, email`,
            [token]
        );
        if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired token' });
        res.json({ message: 'Email verified! You can now log in.' });
    } catch (err) {
        console.error('VERIFY ERROR:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;