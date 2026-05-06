import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173']
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));