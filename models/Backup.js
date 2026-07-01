const mongoose = require('../database');

const backupSchema = new mongoose.Schema({
  backupId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  createdById: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  data: { type: Object, required: true }
});

module.exports = mongoose.model('Backup', backupSchema);
