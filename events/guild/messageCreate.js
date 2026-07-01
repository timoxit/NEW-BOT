const logger = require('../../utils/logger');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');
const User = require('../../models/User');
const Warning = require('../../models/Warning');

// Anti-spam in-memory cache
const spamMap = new Map();
const xpCooldown = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.bot) return;

    try {
      const settings = await Guild.findOne({ guildId: message.guild.id });
      if (!settings) return;

      // ==========================================
      // AUTOMOD MODULE
      // ==========================================
      if (settings.automod.enabled) {
        let trigger = false;
        let reason = '';

        // 1. Anti-Invite
        if (settings.automod.antiinvite) {
          const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discord(app)?\.com\/invite\/.+)/gi;
          if (inviteRegex.test(message.content)) {
            trigger = true;
            reason = 'Posting invite link';
          }
        }

        // 2. Anti-Link (excluding invites if anti-invite is false, but covers everything if true)
        if (!trigger && settings.automod.antilink) {
          const urlRegex = /(https?:\/\/[^\s]+)/gi;
          if (urlRegex.test(message.content)) {
            trigger = true;
            reason = 'Posting external links';
          }
        }

        // 3. Badwords
        if (!trigger && settings.automod.badwords.length > 0) {
          const contentLower = message.content.toLowerCase();
          const matchesWord = settings.automod.badwords.some(word => contentLower.includes(word.toLowerCase()));
          if (matchesWord) {
            trigger = true;
            reason = 'Using blacklisted words';
          }
        }

        // 4. Mention Limit
        if (!trigger && settings.automod.mentionLimit > 0) {
          const totalMentions = message.mentions.users.size + message.mentions.roles.size;
          if (totalMentions > settings.automod.mentionLimit) {
            trigger = true;
            reason = `Exceeded mention limit (${totalMentions}/${settings.automod.mentionLimit})`;
          }
        }

        // 5. Anti-Spam
        if (!trigger && settings.automod.antispam) {
          const spamKey = `${message.guild.id}_${message.author.id}`;
          const now = Date.now();
          
          if (!spamMap.has(spamKey)) {
            spamMap.set(spamKey, []);
          }

          const timestamps = spamMap.get(spamKey);
          timestamps.push(now);

          // Keep last 5 seconds of logs
          const filtered = timestamps.filter(time => now - time < 5000);
          spamMap.set(spamKey, filtered);

          if (filtered.length > 6) { // More than 6 messages in 5 seconds
            trigger = true;
            reason = 'Spamming messages';
            spamMap.delete(spamKey); // Reset
          }
        }

        // Execute automod punishment
        if (trigger) {
          try {
            await message.delete().catch(() => {});
          } catch (e) {}

          const punishment = settings.automod.punishment || 'warn';
          const member = message.member;

          if (member) {
            if (punishment === 'warn') {
              const warning = new Warning({
                guildId: message.guild.id,
                userId: member.id,
                moderatorId: client.user.id,
                reason: `[AutoMod] ${reason}`
              });
              await warning.save();

              await message.channel.send({
                content: `<@${member.id}>`,
                embeds: [embeds.error(`You have been warned for: **${reason}**.`, '⚠️ Automod Warning')]
              });
            } else if (punishment === 'timeout') {
              try {
                await member.timeout(10 * 60 * 1000, `[AutoMod] ${reason}`);
                await message.channel.send({
                  content: `<@${member.id}>`,
                  embeds: [embeds.error(`You have been timed out for 10 minutes for: **${reason}**.`, '⚠️ Automod Timeout')]
                });
              } catch (err) {
                logger.error('Failed to timeout member in automod:', err);
              }
            } else if (punishment === 'kick') {
              try {
                await member.kick(`[AutoMod] ${reason}`);
                await message.channel.send({
                  embeds: [embeds.error(`<@${member.id}> has been kicked from the server for: **${reason}**.`, '⚠️ Automod Kick')]
                });
              } catch (err) {
                logger.error('Failed to kick member in automod:', err);
              }
            } else if (punishment === 'ban') {
              try {
                await member.ban({ reason: `[AutoMod] ${reason}` });
                await message.channel.send({
                  embeds: [embeds.error(`<@${member.id}> has been banned from the server for: **${reason}**.`, '⚠️ Automod Ban')]
                });
              } catch (err) {
                logger.error('Failed to ban member in automod:', err);
              }
            }
          }
          return; // Stop processing further features for this message
        }
      }

      // ==========================================
      // LEVELING SYSTEM
      // ==========================================
      if (settings.levels && settings.levels.enabled) {
        const xpKey = `${message.guild.id}_${message.author.id}`;
        const now = Date.now();

        // 1 minute cooldown on XP gain
        if (!xpCooldown.has(xpKey) || now - xpCooldown.get(xpKey) >= 60000) {
          xpCooldown.set(xpKey, now);

          let userDoc = await User.findOne({ guildId: message.guild.id, userId: message.author.id });
          if (!userDoc) {
            userDoc = new User({ guildId: message.guild.id, userId: message.author.id });
          }

          const xpGained = Math.floor(Math.random() * 11) + 15; // 15-25 XP
          userDoc.xp += xpGained;

          // Formula: Level up target = level * 100 + 100
          const xpToLevelUp = userDoc.level * 100 + 100;

          if (userDoc.xp >= xpToLevelUp) {
            userDoc.xp -= xpToLevelUp;
            userDoc.level += 1;

            // Notify level up
            await message.channel.send({
              content: `🎉 Congratulations <@${message.author.id}>, you leveled up to **Level ${userDoc.level}**!`
            }).catch(() => {});

            // Check and apply level reward roles
            if (settings.levels.rewards && settings.levels.rewards.length > 0) {
              const rewards = settings.levels.rewards.filter(r => r.level <= userDoc.level);
              for (const reward of rewards) {
                try {
                  const role = message.guild.roles.cache.get(reward.roleId);
                  if (role && !message.member.roles.cache.has(role.id)) {
                    await message.member.roles.add(role);
                  }
                } catch (e) {
                  logger.error(`Error applying level reward role ${reward.roleId}:`, e);
                }
              }
            }
          }

          await userDoc.save();
        }
      }
    } catch (err) {
      logger.error('Error in messageCreate event handler:', err);
    }
  }
};
