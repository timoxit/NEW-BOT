const config = require('../config');
const Guild = require('../models/Guild');
const { PermissionFlagsBits } = require('discord.js');

/**
 * Checks if the user is the bot owner
 * @param {string} userId 
 * @returns {boolean}
 */
function isOwner(userId) {
  return config.ownerId === userId;
}

/**
 * Validates guild premium status
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
async function checkPremium(guildId) {
  if (!guildId) return false;
  try {
    const guildSettings = await Guild.findOne({ guildId });
    if (!guildSettings) return false;
    
    if (guildSettings.isPremium) {
      if (!guildSettings.premiumExpiresAt || guildSettings.premiumExpiresAt > new Date()) {
        return true;
      }
      // Premium expired, deactivate
      guildSettings.isPremium = false;
      guildSettings.premiumExpiresAt = null;
      await guildSettings.save();
    }
    return false;
  } catch (error) {
    console.error('Error validating premium status:', error);
    return false;
  }
}

/**
 * Checks if a member has required permissions
 * @param {GuildMember} member 
 * @param {bigint[]} permissions 
 * @returns {boolean}
 */
function hasPermissions(member, permissions = []) {
  if (!member) return false;
  if (member.id === config.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return permissions.every(perm => member.permissions.has(perm));
}

module.exports = {
  isOwner,
  checkPremium,
  hasPermissions
};
