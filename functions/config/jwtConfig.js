const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

function generateToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token, callback) {
    jwt.verify(token, JWT_SECRET, callback);
}

module.exports = {
    generateToken,
    verifyToken
};
