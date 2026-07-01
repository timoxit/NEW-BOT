const mongoose = require('../database');

const ticketSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  claimedBy: { type: String, default: null },
  status: { type: String, enum: ['open', 'closed', 'claimed'], default: 'open' },
  closedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Ticket', ticketSchema);
