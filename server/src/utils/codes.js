const { customAlphabet } = require('nanoid');

// Avoid ambiguous characters: 0/O, 1/I/l
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateRoomCode = customAlphabet(alphabet, 6);
const generateId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);
const generateToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 32);

module.exports = {
  generateRoomCode,
  generateId,
  generateToken,
};
