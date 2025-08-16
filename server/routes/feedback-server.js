// server/routes/feedback-server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const FEEDBACK_PATH  = path.join(__dirname, '..', '..', 'data', 'feedback.json');
const PURCHASES_PATH = path.join(__dirname, '..', '..', 'data', 'purchases.json');

async function loadJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function saveJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

function requireLogin(req, res, next) {
  const u = req.cookies?.username;
  if (!u) return res.status(401).json({ ok:false, error:'Not logged in' });
  req.username = u;
  next();
}

// (Very light) "admin" gate—adjust to your app’s real admin check if you have one
function requireAdmin(req, res, next) {
  const u = req.cookies?.username;
  if (u !== 'admin') return res.status(403).json({ ok:false, error:'Forbidden' });
  next();
}

// POST /api/feedback
// body: { name, email, message, orderId? }
router.post('/feedback', requireLogin, async (req, res) => {
  const b = req.body || {};
  const entry = {
    at: new Date().toISOString(),
    username: req.username,                  // <- from cookie
    name: (b.name || '').toString().trim(),
    email: (b.email || '').toString().trim(),
    message: (b.message || '').toString().trim(),
    orderId: (b.orderId || '').toString().trim() || null,
    orderVerified: false
  };

  if (!entry.message || !entry.name || !entry.email) {
    return res.status(400).json({ ok:false, error:'Missing fields' });
  }

  // (Optional) verify order belongs to this user
  if (entry.orderId) {
    const purchases = await loadJson(PURCHASES_PATH, {});
    const mine = purchases[req.username] || [];
    entry.orderVerified = !!mine.find(o => String(o.orderId) === String(entry.orderId));
  }

  const all = await loadJson(FEEDBACK_PATH, []);
  all.push(entry);
  await saveJson(FEEDBACK_PATH, all);
  res.json({ ok:true });
});

// GET /api/admin/feedbacks  (admin only)
router.get('/admin/feedbacks', requireAdmin, async (req, res) => {
  const all = await loadJson(FEEDBACK_PATH, []);
  // newest first
  all.sort((a, b) => (a.at < b.at ? 1 : -1));
  res.json({ ok:true, feedbacks: all });
});

module.exports = router;
