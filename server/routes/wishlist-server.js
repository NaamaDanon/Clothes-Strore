// server/routes/wishlist-server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const WISHLIST_PATH = path.join(__dirname, '..', '..', 'data', 'wishlist.json');

// helpers
async function loadWish() {
  try {
    const raw = await fs.readFile(WISHLIST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}
async function saveWish(map) {
  await fs.writeFile(WISHLIST_PATH, JSON.stringify(map, null, 2), 'utf8');
}

function requireLogin(req, res, next) {
  const username = req.cookies?.username;
  if (!username) return res.status(401).json({ ok: false, error: 'Not logged in' });
  req.username = username;
  next();
}

// GET /api/wishlist  -> { ok, items: ["1","4",...] }
router.get('/wishlist', requireLogin, async (req, res) => {
  const map = await loadWish();
  res.json({ ok: true, items: map[req.username] || [] });
});

// POST /api/wishlist  { productId } -> add (no duplicates)
router.post('/wishlist', requireLogin, async (req, res) => {
  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ ok: false, error: 'Missing productId' });

  const map = await loadWish();
  const list = map[req.username] || [];
  const id = String(productId);
  if (!list.includes(id)) list.push(id);
  map[req.username] = list;
  await saveWish(map);

  res.json({ ok: true, items: list });
});

// DELETE /api/wishlist/:productId -> remove
router.delete('/wishlist/:productId', requireLogin, async (req, res) => {
  const { productId } = req.params;
  const map = await loadWish();
  const list = map[req.username] || [];
  const id = String(productId);
  const idx = list.indexOf(id);
  if (idx !== -1) list.splice(idx, 1);
  map[req.username] = list;
  await saveWish(map);

  res.json({ ok: true, items: list });
});

module.exports = router;
