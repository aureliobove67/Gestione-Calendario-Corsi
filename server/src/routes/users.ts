import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';

const router = Router();
const audit = withAudit('user');

// GET /api/admin/users
router.get('/', (req: Request, res: Response) => {
  try {
    const users = db.prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY id').all();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users
router.post('/', (req: Request, res: Response) => {
  try {
    const { username, password, display_name } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hash, display_name || username, 'admin', req.user!.id);

    const newUser = { id: result.lastInsertRowid, username, display_name: display_name || username, role: 'admin' };
    audit.create(req, Number(result.lastInsertRowid), newUser);

    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    if (id === req.user!.id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    audit.delete(req, id, user);

    res.json({ message: 'User deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
