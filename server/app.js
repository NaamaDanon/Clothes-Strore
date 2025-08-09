const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

// ADD THIS LINE:
const loginRouter = require('./routes/login-server');
const registerRouter = require('./routes/register-server');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ADD THIS LINE:
app.use('/api', loginRouter);
app.use('/api', registerRouter);


// Temporary test route
app.get('/api/test', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
