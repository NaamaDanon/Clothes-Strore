// server/routes/cart-server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { appendActivity } = require('../lib/audit');

const router = express.Router();
const CARTS_PATH = path.join(__dirname, '..', '..', 'data', 'carts.json');

// Load & Save helpers
async function loadCarts() {
  try {
    const raw = await fs.readFile(CARTS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return {}; // first run
    throw e;
  }
}
async function saveCarts(carts) {
  await fs.writeFile(CARTS_PATH, JSON.stringify(carts, null, 2), 'utf8');
}

// Require login middleware
function requireLogin(req, res, next) {
  const username = req.cookies?.username;
  if (!username) return res.status(401).json({ ok: false, error: 'Not logged in' });
  req.username = username;
  next();
}

// GET /api/cart  -> list current user's cart (array of productIds)
router.get('/cart', requireLogin, async (req, res) => {
  const carts = await loadCarts();
  let list = carts[req.username] || [];

  list = list.map(item =>
    (typeof item === 'string' || typeof item === 'number')
      ? { id: String(item), size: null }
      : { id: String(item.id), size: item.size ?? null }
  );

  res.json({ ok: true, items: list });
});


router.post('/cart', requireLogin, async (req, res) => {
  const { productId, size } = req.body || {};
  if (!productId) return res.status(400).json({ ok: false, error: 'Missing productId' });
  if (!size)      return res.status(400).json({ ok: false, error: 'Missing size' });

  const carts = await loadCarts();
  const list = carts[req.username] || [];

  list.push({ id: String(productId), size: String(size) }); // store id + size
  carts[req.username] = list;

  await saveCarts(carts);
  res.json({ ok: true, items: list });
});


// DELETE /api/cart/:productId -> remove one occurrence of productId
router.delete('/cart/:productId', requireLogin, async (req, res) => {
  const { productId } = req.params;
  const carts = await loadCarts();
  const list = (carts[req.username] || []).map(item =>
    (typeof item === 'string' || typeof item === 'number') ? { id: String(item), size: null } : item
  );

  const idx = list.findIndex(it => String(it.id) === String(productId));
  if (idx !== -1) list.splice(idx, 1);

  carts[req.username] = list;
  await saveCarts(carts);
  res.json({ ok: true, items: list });
});


module.exports = router;
