require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { initSchema } = require('./db');

initSchema();
console.log('Database schema initialized successfully.');
