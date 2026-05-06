import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1]; // Assuming Bearer token
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        (req as any).user = decoded;
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
};
