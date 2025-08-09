
const { appendActivity } = require('../lib/audit');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Resolve .../data/users.json from server/routes/
const USERS_PATH = path.join(__dirname, '..', '..', 'data', 'users.json');

async function loadUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    // Supported shapes:
    // 1) [ { username, password }, ... ]
    if (Array.isArray(parsed)) return parsed;

    // 2) { users: [ { username, password }, ... ] }
    if (parsed && Array.isArray(parsed.users)) return parsed.users;

    // 3) { "<username>": { password: "..." }, ... }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([username, obj]) => ({
        username,
        password: obj && obj.password
      }));
    }

    throw new Error('Unsupported users.json structure');
  } catch (e) {
    // Re-throw with more context
    e.message = `Failed reading users at: ${USERS_PATH}\n${e.message}`;
    throw e;
  }
}

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, remember } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Missing credentials' });
    }

    const users = await loadUsers();
    const user = users.find(u => u.username === username);

    if (!user || user.password !== password) {
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }

    // 12 days if "remember", else 30 minutes
    const maxAge = remember ? 12 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000;

    // Cookie name MUST match /api/check-login
    res.cookie('username', username, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge
    });
    await appendActivity(username, 'login');
    return res.json({ ok: true, username });
  } catch (err) {
    console.error('Login error:', err); // ← See full stack in server console
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Optional: logout for testing
router.post('/logout', async (req, res) => {
  await appendActivity(req.cookies?.username || '', 'logout');
  res.clearCookie('username', { path: '/' });
  res.json({ ok: true });
});

module.exports = router;


