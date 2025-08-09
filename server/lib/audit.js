
const fs = require('fs').promises;
const path = require('path');

const ACT_PATH = path.join(__dirname, '..', '..', 'data', 'activity.json');

async function load() {
  try {
    const raw = await fs.readFile(ACT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}
async function save(arr) {
  await fs.writeFile(ACT_PATH, JSON.stringify(arr, null, 2), 'utf8');
}

async function appendActivity(username, type) {
  const list = await load();
  list.push({
    at: new Date().toISOString(),
    username: String(username || ''),
    type: String(type || '')
  });
  await save(list);
}

module.exports = { appendActivity, load };
