// server/routes/checkout-server.js
// Same API as your older version:
//   - GET  /api/checkout                 -> { ok, items, total }
//   - POST /api/checkout/submit          -> body: { items:[ids], payment:{ name, card, expiry, cvv } }
// Differences:
//   - Each item's price now includes print extra if present
//   - Total includes print extras
//   - Safer cart handling (entries can be strings or objects)

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// if your app already sets body parsers globally, this is still safe (noop)
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const CARTS_PATH     = path.join(__dirname, '..', '..', 'data', 'carts.json');
const PURCHASES_PATH = path.join(__dirname, '..', '..', 'data', 'purchases.json');
const DELIVERY_PATH  = path.join(__dirname, '..', '..', 'data', 'delivery.json');
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
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}
const money = n => Math.round((Number(n) || 0) * 100) / 100;

function requireLogin(req, res, next) {
  const u = req.cookies?.username;
  if (!u) return res.status(401).json({ ok: false, error: 'Not logged in' });
  req.username = u;
  next();
}

// ---------- GET /api/checkout ----------
// Returns { ok, items: [{id,title,image,description,size,print,basePrice,extra,price}], total }
router.get('/checkout', requireLogin, async (req, res) => {
  const [carts, products] = await Promise.all([
    loadJson(CARTS_PATH, {}),
    loadJson(PRODUCTS_PATH, []),
  ]);

  const byId = new Map(products.map(p => [String(p.id), p]));
  const rawCart = carts[req.username] || [];

  const items = rawCart.map(entry => {
    const it = (typeof entry === 'object')
      ? entry
      : { id: String(entry), size: null, print: null };

    const prod = byId.get(String(it.id));
    if (!prod) return null;

    const base  = money(prod.price);
    const print = it.print
      ? {
          type:  String(it.print.type  || ''),
          color: String(it.print.color || ''),
          image: String(it.print.image || ''),
          extra: money(it.print.extra || 5)
        }
      : null;

    const extra = print ? print.extra : 0;

    return {
      id: String(it.id),
      title: prod.title,
      image: prod.image,
      description: prod.description || '',
      size: it.size ?? null,
      print,
      basePrice: base,
      extra,
      price: money(base + extra)
    };
  }).filter(Boolean);

  const total = money(items.reduce((s, p) => s + p.price, 0));
  res.json({ ok: true, items, total });
});

router.get('/checkout/delivery', requireLogin, async (req, res) => {
  try {
    const store = await loadJson(DELIVERY_PATH, {});
    res.json({ ok: true, delivery: store[req.username] || null });
  } catch (e) {
    console.error('delivery GET error', e);
    res.status(500).json({ ok:false, error:'DELIVERY_LOAD_FAILED' });
  }
});

// ---------- POST /api/checkout/delivery ----------
router.post('/checkout/delivery', requireLogin, async (req, res) => {
  try {
    const b = req.body || {};
    // minimal validation — keep it friendly
    const delivery = {
      fullName: (b.fullName || '').toString().trim(),
      phone:    (b.phone || '').toString().trim(),
      country:  (b.country || '').toString().trim(),
      city:     (b.city || '').toString().trim(),
      zip:      (b.zip || '').toString().trim(),
      address1: (b.address1 || '').toString().trim(),
      address2: (b.address2 || '').toString().trim(),
    };
    if (!delivery.fullName || !delivery.address1 || !delivery.city || !delivery.country || !delivery.phone) {
      return res.status(400).json({ ok:false, error:'MISSING_DELIVERY_FIELDS' });
    }
    const store = await loadJson(DELIVERY_PATH, {});
    store[req.username] = delivery;
    await saveJson(DELIVERY_PATH, store);
    res.json({ ok:true });
  } catch (e) {
    console.error('delivery POST error', e);
    res.status(500).json({ ok:false, error:'DELIVERY_SAVE_FAILED' });
  }
});

// ---------- POST /api/checkout/submit ----------
// Body shape (same as your working older version):
//   { items: [<productId>, ...],
//     payment: { name: string, card: string, expiry?: string, cvv?: string } }
router.post('/checkout/submit', requireLogin, async (req, res) => {
  const { items, payment } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'No items selected' });
  }
  // Basic (fake) checks — exactly like before, just a bit more tolerant
  const name = payment?.name?.toString().trim();
  const card = payment?.card?.toString().trim();
  if (!name || !card) {
    return res.status(400).json({ ok: false, error: 'Missing payment details' });
  }

  const [carts, products, purchases] = await Promise.all([
    loadJson(CARTS_PATH, {}),
    loadJson(PRODUCTS_PATH, []),
    loadJson(PURCHASES_PATH, {}),
  ]);

  const wanted = new Set(items.map(String));
  const byId   = new Map(products.map(p => [String(p.id), p]));

  // Build purchased list from cart so we also capture size/print
  const cart = (carts[req.username] || []).map(entry =>
    (typeof entry === 'object')
      ? { id: String(entry.id), size: entry.size ?? null, print: entry.print || null, qty: entry.qty ?? 1 }
      : { id: String(entry),     size: null,                print: null,           qty: 1 }
  );

  const purchased = [];
  const remaining = [];
  for (const row of cart) {
    if (wanted.has(row.id)) {
      const prod  = byId.get(row.id);
      if (prod) {
        const base  = money(prod.price);
        const extra = row.print ? money(row.print.extra || 5) : 0;
        const qty   = Number(row.qty) || 1;

        purchased.push({
          id: row.id,
          title: prod.title,
          size: row.size,
          qty,
          price: base,       // base price (per unit)
          print: row.print,  // {type,color,image,extra?}
          extra              // print surcharge (per unit)
        });
      }
      // remove only one occurrence per selected id (like your older code)
      wanted.delete(row.id);
    } else {
      remaining.push(row);
    }
  }

  // Compute total (base + extra) * qty
  const total = money(
    purchased.reduce((s, it) => s + (it.price + (it.extra || 0)) * (it.qty || 1), 0)
  );
  const deliveryBook = await loadJson(DELIVERY_PATH, {});
  const delivery = deliveryBook[req.username] || null;

  // Persist purchase and updated cart
  const now = new Date().toISOString();
  const orderId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  if (!purchases[req.username]) purchases[req.username] = [];
  purchases[req.username].push({
    orderId,
    at: now,
    items: purchased,
    total,
    delivery   
  });

  // write back cart without purchased ones
  carts[req.username] = remaining;

  await Promise.all([
    saveJson(PURCHASES_PATH, purchases),
    saveJson(CARTS_PATH, carts),
  ]);

  res.json({ ok: true, orderId });
});

module.exports = router;
