import { Router } from 'express';
import { authRateLimit, passwordResetRateLimit } from '../middleware/index.js';
import { login, logout } from '../controllers/auth/loginController.js';
import { loginCheckpoint } from '../controllers/auth/loginCheckpointController.js';
import { sendResetLinkEmail } from '../controllers/auth/forgotPasswordController.js';
import { resetPassword } from '../controllers/auth/resetPasswordController.js';

const router = Router();

// ---- Authentication ----
router.post('/login', authRateLimit, login);
router.post('/login/checkpoint', authRateLimit, loginCheckpoint);
router.post('/password', passwordResetRateLimit, sendResetLinkEmail);
router.post('/password/reset', resetPassword);
router.post('/logout', logout);

export default router;
