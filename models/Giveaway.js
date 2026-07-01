const mongoose = require('../database');

const giveawaySchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  prize: { type: String, required: true },
  winnerCount: { type: Number, default: 1 },
  winners: { type: [String], default: [] },
  endTime: { type: Date, required: true },
  hostedBy: { type: String, required: true },
  ended: { type: Boolean, default: false },
  paused: { type: Boolean, default: false },
  enteredUsers: { type: [String], default: [] }
});

module.exports = mongoose.model('Giveaway', giveawaySchema);
