require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const allowedOriginPatterns = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  'http://localhost:5173'
)
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardToRegex = (pattern) => {
  const escaped = escapeRegex(pattern).replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`);
};

const allowedOriginRegexes = allowedOriginPatterns.map((pattern) =>
  wildcardToRegex(pattern)
);

const isAllowedOrigin = (origin) =>
  allowedOriginRegexes.some((regex) => regex.test(origin));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 120 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication requests. Please try again later.' },
});

const captionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 80 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many caption requests. Please try again later.' },
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Routes
app.use('/api/auth', authRateLimiter, require('./routes/auth'));
app.use('/api/caption', captionRateLimiter, require('./routes/caption'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max size is 5MB.' });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: err.message });
  }

  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    console.error(err.stack || err);
    return res.status(status).json({ error: 'Internal server error' });
  }

  return res.status(status).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Server startup error:', err.message);
    process.exit(1);
  }
};

startServer();
