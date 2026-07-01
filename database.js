const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const dbPath = path.join(__dirname, 'db.json');

let dbData = {
  Guild: [],
  User: [],
  Warning: [],
  Ticket: [],
  Giveaway: [],
  Backup: [],
  Premium: [],
  ReactionRole: []
};

// Load database on startup
function loadDb() {
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(content);
      dbData = { ...dbData, ...parsed };
      logger.info('Local JSON database loaded successfully from db.json.');
    } catch (err) {
      logger.error('Failed to parse local JSON database, starting fresh:', err);
    }
  } else {
    saveDbSync();
    logger.info('Created new local JSON database (db.json).');
  }
}

let isSaving = false;
let saveQueue = false;

async function saveDb() {
  if (isSaving) {
    saveQueue = true;
    return;
  }
  isSaving = true;
  try {
    await fs.promises.writeFile(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (err) {
    logger.error('Failed to write local database to disk:', err);
  } finally {
    isSaving = false;
    if (saveQueue) {
      saveQueue = false;
      saveDb();
    }
  }
}

function saveDbSync() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (err) {
    logger.error('Failed to write local database sync:', err);
  }
}

function matchQuery(item, query) {
  if (!query) return true;
  for (const key in query) {
    const val = query[key];
    
    // Check if query is an object like { $in: [...] } or { $lte: date }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('$in' in val) {
        if (!val.$in.includes(item[key])) return false;
        continue;
      }
      if ('$lte' in val) {
        const itemVal = item[key] instanceof Date ? item[key] : new Date(item[key]);
        const compareVal = val.$lte instanceof Date ? val.$lte : new Date(val.$lte);
        if (itemVal > compareVal) return false;
        continue;
      }
    }
    
    if (item[key] !== val) return false;
  }
  return true;
}

function chainQuery(results) {
  const queryChain = [...results];
  queryChain.sort = function(sortObj) {
    const key = Object.keys(sortObj)[0];
    const order = sortObj[key];
    const sorted = [...results].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return order === -1 ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return order === -1 ? valB - valA : valA - valB;
    });
    return chainQuery(sorted);
  };
  queryChain.limit = function(limitNum) {
    return chainQuery(results.slice(0, limitNum));
  };
  return queryChain;
}

function fillDefaults(target, definition) {
  for (const key in definition) {
    const val = definition[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('default' in val) {
        target[key] = typeof val.default === 'function' ? val.default() : JSON.parse(JSON.stringify(val.default));
      } else {
        target[key] = {};
        fillDefaults(target[key], val);
      }
    }
  }
}

const mongooseMock = {
  Schema: class Schema {
    constructor(definition) {
      this.definition = definition;
    }
    index() {}
  },
  
  model(name, schema) {
    class ModelInstance {
      constructor(data = {}) {
        // Load schema defaults first
        if (schema && schema.definition) {
          fillDefaults(this, schema.definition);
        }
        Object.assign(this, data);
        this._modelName = name;
        if (!this._id) {
          this._id = Math.random().toString(36).substring(2, 15);
        }
      }

      async save() {
        const list = dbData[name];
        const idx = list.findIndex(item => item._id === this._id);
        
        const plain = { ...this };
        delete plain._modelName;
        
        if (idx !== -1) {
          list[idx] = plain;
        } else {
          list.push(plain);
        }
        
        await saveDb();
        return this;
      }
    }

    // Static methods
    ModelInstance.findOne = function(query) {
      const list = dbData[name] || [];
      const found = list.find(item => matchQuery(item, query));
      return found ? new ModelInstance(found) : null;
    };

    ModelInstance.find = function(query) {
      const list = dbData[name] || [];
      const matched = list.filter(item => matchQuery(item, query)).map(item => new ModelInstance(item));
      return chainQuery(matched);
    };

    ModelInstance.deleteOne = async function(query) {
      const list = dbData[name] || [];
      const idx = list.findIndex(item => matchQuery(item, query));
      if (idx !== -1) {
        list.splice(idx, 1);
        await saveDb();
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    };

    ModelInstance.deleteMany = async function(query) {
      const initialLength = (dbData[name] || []).length;
      dbData[name] = (dbData[name] || []).filter(item => !matchQuery(item, query));
      await saveDb();
      const deletedCount = initialLength - dbData[name].length;
      return { deletedCount };
    };

    return ModelInstance;
  },

  connection: {
    readyState: 1,
    on(event, handler) {
      if (event === 'connected') {
        setTimeout(() => handler(), 100);
      }
    }
  },

  async connect() {
    loadDb();
    logger.info('Mock MongoDB connection established.');
  }
};

async function connectDatabase() {
  loadDb();
  logger.info('Successfully connected to Local JSON Database.');
}

module.exports = {
  ...mongooseMock,
  connectDatabase
};
