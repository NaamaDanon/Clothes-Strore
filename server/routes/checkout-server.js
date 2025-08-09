// server/routes/checkout-server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

const CARTS_PATH     = path.join(__dirname, '..', '..', 'data', 'carts.json');
const PURCHASES_PATH = path.join(__dirname, '..', '..', 'data', 'purchases.json');
const PRODUCTS_PATH  = path.join(__dirname, '..', '..', 'public', 'products.json');

// ---------- helpers ----------
async function loadJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}
async function saveJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

function requireLogin(req, res, next) {
  const u = req.cookies?.username;
  if (!u) return res.status(401).json({ ok: false, error: 'Not logged in' });
  req.username = u;
  next();
}

// ---------- GET /api/checkout ----------
// Returns { ok, items: [{id, title, image, price, description}], total }
router.get('/checkout', requireLogin, async (req, res) => {
  const [carts, products] = await Promise.all([
    loadJson(CARTS_PATH, {}),
    loadJson(PRODUCTS_PATH, []),
  ]);

  const raw = carts[req.username] || [];
  const ids = raw.map(it =>
    (typeof it === 'string' || typeof it === 'number')
        ? String(it)
        : String(it.id)   // handle { id, size }
    );
  if (!ids.length) return res.json({ ok: true, items: [], total: 0 });

  const map = new Map(products.map(p => [String(p.id), p]));
  const items = ids
    .map(id => map.get(id))
    .filter(Boolean)
    .map(p => ({
      id: String(p.id),
      title: p.title,
      image: p.image,
      description: p.description || '',
      price: typeof p.price === 'number' ? p.price : 0
    }));

  const total = items.reduce((s, p) => s + (p.price || 0), 0);
  res.json({ ok: true, items, total });
});

// ---------- POST /api/checkout/submit ----------

router.post('/checkout/submit', requireLogin, async (req, res) => {
  const { items, payment } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'No items selected' });
  }

  // (Fake) basic checks
  if (!payment || !payment.name || !payment.card) {
    return res.status(400).json({ ok: false, error: 'Missing payment details' });
  }

  const [carts, products, purchases] = await Promise.all([
    loadJson(CARTS_PATH, {}),
    loadJson(PRODUCTS_PATH, []),
    loadJson(PURCHASES_PATH, {}),
  ]);

  const idSet = new Set(items.map(String));
  const map = new Map(products.map(p => [String(p.id), p]));
  const purchased = [];
  let total = 0;

  idSet.forEach(id => {
    const p = map.get(id);
    if (p) {
      purchased.push({
        id,
        title: p.title,
        price: typeof p.price === 'number' ? p.price : 0
      });
      total += typeof p.price === 'number' ? p.price : 0;
    }
  });

  // Persist purchase
  const now = new Date().toISOString();
  const orderId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  if (!purchases[req.username]) purchases[req.username] = [];
  purchases[req.username].push({
    orderId,
    at: now,
    items: purchased,
    total
  });

  // Remove purchased items from cart (remove one occurrence per selected id)
  const currentCart = (carts[req.username] || []).map(it =>
  (typeof it === 'string' || typeof it === 'number')
    ? { id: String(it), size: null }
    : { id: String(it.id), size: it.size ?? null }
  );
  const remaining = [...currentCart];
  for (const id of items.map(String)) {
  const idx = remaining.findIndex(it => String(it.id) === id);
  if (idx !== -1) remaining.splice(idx, 1);
  }
carts[req.username] = remaining;

  await Promise.all([
    saveJson(PURCHASES_PATH, purchases),
    saveJson(CARTS_PATH, carts),
  ]);

  res.json({ ok: true, orderId });
});

module.exports = router;
