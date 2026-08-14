/**
 * Lightweight JSON file database.
 * No native dependencies — works on any Node environment including Render free tier.
 */
const fs = require('fs');
const path = require('path');

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let store = null;
let dbPath = null;

const DEFAULT_DATA = {
  rooms: [],
  participants: [],
  questions: [],
  options: [],
  answers: [],
  users: [],
  sessions: [],
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function load() {
  if (store) return store;
  if (isPostgres) {
    throw new Error('PostgreSQL adapter not implemented in this version. Use a file path for DATABASE_URL.');
  }
  dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../data/fungame.db.json');
  if (dbPath.endsWith('.db') || dbPath.endsWith('.sqlite') || dbPath.endsWith('.sqlite3')) {
    dbPath = dbPath.replace(/\.(db|sqlite3?)$/, '.db.json');
  }
  if (!dbPath.endsWith('.json')) {
    dbPath = dbPath + '.json';
  }
  ensureDir(dbPath);
  if (fs.existsSync(dbPath)) {
    try {
      store = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch {
      store = { ...DEFAULT_DATA };
    }
  } else {
    store = { ...DEFAULT_DATA };
  }
  for (const k of Object.keys(DEFAULT_DATA)) {
    if (!Array.isArray(store[k])) store[k] = [];
  }
  return store;
}

function save() {
  if (!store || !dbPath) return;
  ensureDir(dbPath);
  const tmp = dbPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 0), 'utf8');
  fs.renameSync(tmp, dbPath);
}

function getDb() {
  load();
  return { _store: store, _save: save };
}

function initSchema() {
  load();
  save();
  return getDb();
}

function findOne(collection, predicate) {
  load();
  return store[collection].find(predicate) || undefined;
}

function findMany(collection, predicate) {
  load();
  return predicate ? store[collection].filter(predicate) : [...store[collection]];
}

function insert(collection, row) {
  load();
  store[collection].push(row);
  save();
  return row;
}

function update(collection, predicate, updater) {
  load();
  let changed = false;
  store[collection] = store[collection].map((row) => {
    if (predicate(row)) {
      changed = true;
      return typeof updater === 'function' ? updater(row) : { ...row, ...updater };
    }
    return row;
  });
  if (changed) save();
}

function remove(collection, predicate) {
  load();
  const before = store[collection].length;
  store[collection] = store[collection].filter((row) => !predicate(row));
  if (store[collection].length !== before) save();
}

function count(collection, predicate) {
  load();
  return predicate ? store[collection].filter(predicate).length : store[collection].length;
}

module.exports = {
  getDb,
  initSchema,
  findOne,
  findMany,
  insert,
  update,
  remove,
  count,
  save,
  load,
};
