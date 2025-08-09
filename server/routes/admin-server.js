// server/routes/admin-server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const { load: loadActivity } = require('../lib/audit');

const router = express.Router();
const PRODUCTS_PATH = path.join(__dirname, '..', '..', 'public', 'products.json');
const UPLOAD_DIR    = path.join(__dirname, '..', '..', 'public', 'images', 'products');

// ---- auth: only "admin" can access ----
function requireAdmin(req, res, next) {
  const u = req.cookies?.username;
  if (u !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  next();
}

// ---- helpers ----
async function loadProducts() {
  try {
    const raw = await fs.readFile(PRODUCTS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}
async function saveProducts(list) {
  await fs.mkdir(path.dirname(PRODUCTS_PATH), { recursive: true });
  await fs.writeFile(PRODUCTS_PATH, JSON.stringify(list, null, 2), 'utf8');
}
function nextId(list) {
  const max = list.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
  return String(max + 1);
}

// ---- ACTIVITY: GET /api/admin/activity?prefix=abc ----
router.get('/admin/activity', requireAdmin, async (req, res) => {
  const prefix = (req.query.prefix || '').toLowerCase();
  const all = await loadActivity();
  const rows = prefix
    ? all.filter(r => (r.username || '').toLowerCase().startsWith(prefix))
    : all;
  res.json({ ok: true, rows });
});

// ---- PRODUCTS ----
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '.jpg') || '.jpg';
      cb(null, `prod_${Date.now()}${ext}`);
    }
  })
});

// GET /api/admin/products
router.get('/admin/products', requireAdmin, async (req, res) => {
  const list = await loadProducts();
  res.json({ ok: true, products: list });
});

// POST /api/admin/products   (multipart OR JSON)
// - multipart fields: title, description, price, image (file)
// - or JSON: { title, description, price, imageUrl }
router.post('/admin/products', requireAdmin, upload.single('image'), async (req, res) => {
  const isMultipart = !!req.file || (req.headers['content-type']||'').includes('multipart');
  let title, description, price, image;

  if (isMultipart) {
    ({ title, description, price } = req.body || {});
    if (req.file) {
      const rel = path.join('images', 'products', req.file.filename).replace(/\\/g, '/');
      image = rel;
    }
  } else {
    ({ title, description, price, imageUrl: image } = req.body || {});
  }

  title = (title || '').trim();
  description = (description || '').trim();
  const priceNum = price === undefined || price === '' ? undefined : Number(price);

  if (!title) return res.status(400).json({ ok:false, error:'Missing title' });
  if (!image) return res.status(400).json({ ok:false, error:'Missing image (file or URL)' });

  const list = await loadProducts();
  const id = nextId(list);
  const prod = { id, title, description, image };
  if (Number.isFinite(priceNum)) prod.price = priceNum;

  list.push(prod);
  await saveProducts(list);
  res.json({ ok:true, product: prod });
});

// DELETE /api/admin/products/:id
router.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const list = await loadProducts();
  const idx = list.findIndex(p => String(p.id) === id);
  if (idx === -1) return res.status(404).json({ ok:false, error:'Not found' });
  const [removed] = list.splice(idx, 1);
  await saveProducts(list);
  res.json({ ok:true, removed });
});

module.exports = router;
