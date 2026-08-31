const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

// ADD THIS LINE:
const loginRouter = require('./routes/login-server');
const registerRouter = require('./routes/register-server');
const cartRouter = require('./routes/cart-server'); 
const checkoutRouter = require('./routes/checkout-server');
const myItemsRouter = require('./routes/myitems-server');
const adminRouter = require('./routes/admin-server'); 
const wishlistRouter = require('./routes/wishlist-server')
const feedbackRouter = require('./routes/feedback-server');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.get('/', (req, res) => {
  res.redirect('/store.html');
});
app.get('/api/whoami', (req, res) => {
  res.json({ username: req.cookies?.username || null });
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// ADD THIS LINE:
app.use('/api', loginRouter);
app.use('/api', registerRouter);
app.use('/api', cartRouter);  
app.use('/api', checkoutRouter); 
app.use('/api', myItemsRouter); 
app.use('/api', adminRouter);
app.use('/api', wishlistRouter);
app.use('/api', feedbackRouter);

// Check login status route
app.get('/api/check-login', (req, res) => {
  try {
    // Assuming you store the logged-in username in a cookie called "username"
    const isLogged = !!(req.cookies && req.cookies.username);
    res.json({ loggedIn: isLogged });
  } catch (err) {
    console.error('Error in /api/check-login:', err);
    res.status(500).json({ loggedIn: false, error: 'Internal server error' });
  }
});

// Temporary test route
app.get('/api/test', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

