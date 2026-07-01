const mongoose = require('mongoose');

const premiumSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  durationDays: { type: Number, required: true },
  redeemed: { type: Boolean, default: false },
  redeemedBy: { type: String, default: null },
  redeemedAt: { type: Date, default: null },
  guildId: { type: String, default: null }
});

module.exports = mongoose.model('Premium', premiumSchema);
