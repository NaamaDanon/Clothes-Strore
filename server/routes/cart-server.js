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

  list = list.map(item => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { id: String(item), size: null, print: null };
    }
    const out = {
      id: String(item.id),
      size: item.size ?? null,
      print: null
    };
    if (item.print) {
      out.print = {
        type:  String(item.print.type || ''),
        color: String(item.print.color || ''),
        image: String(item.print.image || ''),
        extra: Number(item.print.extra) || 5
      };
    }
    return out;
  });

  res.json({ ok: true, items: list });
});


// router.post('/cart', requireLogin, async (req, res) => {
//   const { productId, size } = req.body || {};
//   if (!productId) return res.status(400).json({ ok: false, error: 'Missing productId' });
//   if (!size)      return res.status(400).json({ ok: false, error: 'Missing size' });

//   const carts = await loadCarts();
//   const list = carts[req.username] || [];

//   list.push({ id: String(productId), size: String(size) }); // store id + size
//   carts[req.username] = list;

//   await saveCarts(carts);
//   res.json({ ok: true, items: list });
// });
// POST /api/cart
router.post('/cart', requireLogin, async (req, res) => {
  const { productId, size, print } = req.body || {};
  if (!productId) return res.status(400).json({ ok: false, error: 'Missing productId' });
  if (!size)      return res.status(400).json({ ok: false, error: 'Missing size' });

  const carts = await loadCarts();            // your existing helpers
  const list  = carts[req.username] || [];

  list.push({
    id: String(productId),
    size: String(size),
    // persist the customization if present
    print: print ? {
      type:  String(print.type || ''),
      color: String(print.color || ''),
      image: String(print.image || ''),
      extra: Number(print.extra) || 5
    } : null
  });

  carts[req.username] = list;
  await saveCarts(carts);
  await appendActivity(req.username, 'add-to-cart');
  res.json({ ok: true, items: list });
});



// DELETE /api/cart/:productId -> remove one occurrence of productId
router.delete('/cart/:productId', requireLogin, async (req, res) => {
  const { productId } = req.params;
  const carts = await loadCarts();

  const list = (carts[req.username] || []).map(item => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { id: String(item), size: null, print: null };
    }
    return {
      id: String(item.id),
      size: item.size ?? null,
      print: item.print ?? null
    };
  });

  const idx = list.findIndex(it => String(it.id) === String(productId));
  if (idx !== -1) list.splice(idx, 1);

  carts[req.username] = list;
  await saveCarts(carts);
  res.json({ ok: true, items: list });
});


module.exports = router;
