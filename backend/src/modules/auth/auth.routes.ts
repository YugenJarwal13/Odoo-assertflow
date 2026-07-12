import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as authService from './auth.service.js';

const router = Router();

// POST /api/auth/signup — creates EMPLOYEE only
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const user = await authService.signup(name, email, password);
    res.status(201).json({ data: user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signup failed';
    res.status(400).json({ error: message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await authService.login(email, password);
    res.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    res.status(401).json({ error: message });
  }
});

// GET /api/auth/me — returns current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ data: user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get user';
    res.status(404).json({ error: message });
  }
});

export default router;
