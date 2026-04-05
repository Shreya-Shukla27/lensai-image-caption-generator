const jwt = require('jsonwebtoken');

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) {
    return null;
  }

  return token.trim();
};

// Hard auth — rejects if no token
const requireAuth = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured' });
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Soft auth — continues even without token (for saving optionally)
const optionalAuth = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return next();
  }

  const token = getBearerToken(req.headers.authorization);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.id;
    } catch {}
  }
  next();
};

module.exports = { requireAuth, optionalAuth };
