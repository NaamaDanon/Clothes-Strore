const express = require('express');
const persist = require('../persist_module');
const cookieParser = require('cookie-parser');
const path = require('path');

const router = express.Router();

router.use(express.json());
router.use(cookieParser());

router.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;
    let users;
    try {
        users = await persist.loadUsers();
    } catch (err) {
        return res.status(500).json({ error: "Server error loading users" });
    }

    const user = users[username];
    const isValid = user && user.password === password;

    // Log the attempt
    const activity = {
        username,
        success: isValid,
        timestamp: new Date().toISOString(),
        action: 'login'
    };
    try {
        await persist.logActivity(activity);
    } catch (err) {
        // Logging failure should not block login
    }

    if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const cookieOptions = {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: rememberMe ? 12 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000 // 12 days or 30 minutes
    };

    res.cookie('loggedin', username, cookieOptions);
    res.json({ success: true });
});

module.exports = router;
