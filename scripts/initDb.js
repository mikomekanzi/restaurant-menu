const { ensureDatabase, createDefaultData } = require('../src/db');

ensureDatabase();
createDefaultData();

console.log('Database initialized with default restaurant and sample menu data.');
