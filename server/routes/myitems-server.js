// server/routes/myitems-server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const PURCHASES_PATH = path.join(__dirname, '..', '..', 'data', 'purchases.json');

async function loadPurchases() {
  try {
    const raw = await fs.readFile(PURCHASES_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return {}; // first run: no file yet
    throw e;
  }
}

function requireLogin(req, res, next) {
  const u = req.cookies?.username;
  if (!u) return res.status(401).json({ ok: false, error: 'Not logged in' });
  req.username = u;
  next();
}

// GET /api/my-items  -> { ok: true, orders: [...] }
router.get('/my-items', requireLogin, async (req, res) => {
  const all = await loadPurchases();
  res.json({ ok: true, orders: all[req.username] || [] });
});

module.exports = router; // <— DO NOT REMOVE
