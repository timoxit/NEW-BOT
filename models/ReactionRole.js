const mongoose = require('../database');

const reactionRoleSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['button', 'select'], default: 'button' },
  roles: [{
    roleId: { type: String, required: true },
    emoji: { type: String, default: null },
    label: { type: String, default: '' },
    style: { type: String, default: 'Primary' } // Primary, Secondary, Success, Danger
  }]
});

module.exports = mongoose.model('ReactionRole', reactionRoleSchema);
