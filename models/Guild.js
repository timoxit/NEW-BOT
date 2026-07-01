const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  logs: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    events: { type: [String], default: [] }
  },
  verification: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    roleId: { type: String, default: null },
    type: { type: String, enum: ['button', 'captcha'], default: 'button' }
  },
  welcome: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    embedTitle: { type: String, default: 'Welcome {user}!' },
    embedDesc: { type: String, default: 'Welcome to the server, {user}! You are member #{memberCount}.' },
    embedColor: { type: String, default: '#5865F2' },
    thumbnail: { type: Boolean, default: true },
    autoRoleId: { type: String, default: null }
  },
  goodbye: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    message: { type: String, default: 'Goodbye {user}, we will miss you!' }
  },
  automod: {
    enabled: { type: Boolean, default: false },
    antispam: { type: Boolean, default: false },
    antiinvite: { type: Boolean, default: false },
    antilink: { type: Boolean, default: false },
    badwords: { type: [String], default: [] },
    mentionLimit: { type: Number, default: 0 },
    antiraid: { type: Boolean, default: false },
    punishment: { type: String, enum: ['warn', 'timeout', 'kick', 'ban'], default: 'warn' }
  },
  tickets: {
    enabled: { type: Boolean, default: false },
    categoryChannelId: { type: String, default: null },
    supportRoleId: { type: String, default: null },
    logsChannelId: { type: String, default: null },
    counter: { type: Number, default: 0 }
  },
  levels: {
    enabled: { type: Boolean, default: false },
    rewards: [{ level: Number, roleId: String }]
  },
  isPremium: { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null }
});

module.exports = mongoose.model('Guild', guildSchema);
