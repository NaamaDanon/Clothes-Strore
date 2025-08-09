const fs = require('fs').promises;
const path = require('path');

const USERS_PATH = path.join(__dirname, '..', 'data', 'users.json');
const ACTIVITY_PATH = path.join(__dirname, '..', 'data', 'activity.json');

// Helper to read JSON file, create if missing, return defaultValue if error
async function readJsonFile(filePath, defaultValue) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // File does not exist, create it
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        } else {
            // JSON parse or other error
            console.error(`Error reading ${filePath}:`, err);
            return defaultValue;
        }
    }
}

// Helper to write JSON file
async function writeJsonFile(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(`[WRITE SUCCESS] ${filePath}`);
    } catch (err) {
        console.error(`[WRITE ERROR] ${filePath}:`, err);
        throw err; // 🔥 Force crash on failure
    }
}


async function loadUsers() {
    return await readJsonFile(USERS_PATH, {});
}

async function logActivity(entry) {
    const activity = await readJsonFile(ACTIVITY_PATH, []);
    const logEntry = {
        datetime: new Date().toISOString(),
        username: entry.username,
        type: entry.type
    };
    activity.push(logEntry);
    await writeJsonFile(ACTIVITY_PATH, activity);
}

async function saveUsers(users) {
  await writeJsonFile(USERS_PATH, users);
}

module.exports = {
    loadUsers,
    saveUsers,
    logActivity
};