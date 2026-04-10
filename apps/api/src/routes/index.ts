import { Router } from 'express';
import applicationRoutes from './application.js';
import clientRoutes from './client.js';
import remoteRoutes from './remote.js';
import authRoutes from './auth.js';
import baseRoutes from './base.js';

const router = Router();

// API routes
router.use('/api/application', applicationRoutes);
router.use('/api/client', clientRoutes);
router.use('/api/remote', remoteRoutes);
router.use('/auth', authRoutes);

// Base SPA routes (must be last — catch-all)
router.use(baseRoutes);

export default router;
