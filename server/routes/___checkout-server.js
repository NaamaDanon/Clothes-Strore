// server/routes/checkout-server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Parse JSON only for this router (safe if app doesn't have global body-parser)
router.use(express.json());

// ----- file paths (relative to server/routes/) -----
const DATA_DIR       = path.join(__dirname, '..', '..', 'data');
const PUBLIC_DIR     = path.join(__dirname, '..', '..', 'public');
const CARTS_PATH     = path.join(DATA_DIR,   'carts.json');
const PURCHASES_PATH = path.join(DATA_DIR,   'purchases.json');
const PRODUCTS_PATH  = path.join(PUBLIC_DIR, 'products.json');

// ----- small helpers -----
async function loadJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function saveJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

// If your app requires login to checkout, flip this to true and enforce cookie.
const AUTH_REQUIRED = false;

function getUsername(req) {
  return req.cookies?.username || 'guest';
}

function requireLogin(req, res, next) {
  if (!AUTH_REQUIRED) return next();
  const u = req.cookies?.username;
  if (!u) return res.status(401).json({ ok: false, error: 'NOT_LOGGED_IN' });
  req.username = u;
  next();
}

// ============ GET /api/checkout ============
// Returns the current cart with computed totals, including print extras.
router.get('/checkout', requireLogin, async (req, res) => {
  try {
    const username = req.username || getUsername(req);

    const [products, carts] = await Promise.all([
      loadJson(PRODUCTS_PATH, []),
      loadJson(CARTS_PATH, {}),
    ]);

    const cart = Array.isArray(carts[username]) ? carts[username] : [];
    const byId = new Map(products.map(p => [String(p.id), p]));

    const items = [];
    for (const row of cart) {
      const id  = String(row?.id ?? '');
      const qty = Number(row?.qty ?? 1) || 1;

      const prod = byId.get(id);
      if (!prod) continue;

      const base  = money(prod.price);
      const print = row?.print
        ? {
            type:  String(row.print.type  ?? ''),
            color: String(row.print.color ?? ''),
            extra: money(row.print.extra ?? 5),
          }
        : null;

      const lineUnit = base + (print ? print.extra : 0);
      const lineTotal = money(lineUnit * qty);

      items.push({
        id,
        title: prod.title,
        description: prod.description || '',
        image: prod.image || '',
        size: row?.size ?? null,
        qty,
        price: base,
        print,
        lineTotal,
      });
    }

    const total = money(items.reduce((s, it) => s + it.lineTotal, 0));
    return res.json({ ok: true, items, total });
  } catch (err) {
    console.error('CHECKOUT ERROR:', err);
    return res.status(500).json({ ok: false, error: 'CHECKOUT_FAILED' });
  }
});

// ============ POST /api/pay ============
// Minimal fake payment: validates fields, records a purchase, clears cart.
router.post('/pay', requireLogin, async (req, res) => {
  try {
    const username = req.username || getUsername(req);
    const { nameOnCard, cardNumber, expiry, cvv, selectedIds } = req.body || {};

    // very light validation for the assignment
    if (![nameOnCard, cardNumber, expiry, cvv].every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_DETAILS' });
    }

    const [products, carts, purchases] = await Promise.all([
      loadJson(PRODUCTS_PATH, []),
      loadJson(CARTS_PATH, {}),
      loadJson(PURCHASES_PATH, {}),
    ]);

    const byId = new Map(products.map(p => [String(p.id), p]));
    const cart = Array.isArray(carts[username]) ? carts[username] : [];

    // If the UI sends a selection of items to pay for, respect it
    const wanted = Array.isArray(selectedIds) && selectedIds.length
      ? new Set(selectedIds.map(x => String(x)))
      : null;

    const purchased = [];
    const remaining = [];

    for (const row of cart) {
      const id = String(row?.id ?? '');
      const prod = byId.get(id);
      if (!prod) continue;

      const base  = money(prod.price);
      const print = row?.print
        ? { type: String(row.print.type ?? ''), color: String(row.print.color ?? ''), extra: money(row.print.extra ?? 5) }
        : null;

      const qty = Number(row?.qty ?? 1) || 1;

      const line = {
        id,
        title: prod.title,
        size: row?.size ?? null,
        qty,
        price: base,
        print,
      };

      if (!wanted || wanted.has(id)) {
        purchased.push(line);
      } else {
        remaining.push(row);
      }
    }

    const total = purchased.reduce((s, it) => {
      const unit = it.price + (it.print ? it.print.extra : 0);
      return s + unit * it.qty;
    }, 0);
    const order = {
      when: Date.now(),
      items: purchased,
      total: money(total),
    };

    const list = purchases[username] || [];
    list.push(order);
    purchases[username] = list;

    // update cart with whatever wasn't purchased (or clear if all purchased)
    carts[username] = remaining;

    await Promise.all([
      saveJson(PURCHASES_PATH, purchases),
      saveJson(CARTS_PATH, carts),
    ]);

    return res.json({ ok: true, orderId: String(order.when) });
  } catch (err) {
    console.error('PAY ERROR:', err);
    return res.status(500).json({ ok: false, error: 'PAY_FAILED' });
  }
});

module.exports = router;
