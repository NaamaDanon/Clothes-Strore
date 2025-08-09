const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load persist module (make sure it exists)
const persist = require('../persist_module');

// Register route
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Missing username or password' });
    }

    const users = await persist.loadUsers();

    if (users[username]) {
        return res.status(409).json({ error: 'Username taken' });
    }

    users[username] = { password, cart: [], purchases: [] };

    await persist.saveUsers(users);

    res.status(200).json({ message: 'User registered successfully' });
});

module.exports = router;
