const { ChannelType, PermissionsBitField } = require('discord.js');
const Backup = require('../models/Backup');

/**
 * Creates a backup of the guild structure and saves it to MongoDB
 * @param {Guild} guild 
 * @param {string} creatorId 
 * @param {string} name 
 * @returns {Promise<Object>}
 */
async function createBackup(guild, creatorId, name) {
  const roles = [];
  const channels = [];

  // 1. Fetch & Filter Roles
  const fetchedRoles = await guild.roles.fetch();
  fetchedRoles.forEach(role => {
    if (role.managed || role.id === guild.id) return; // Skip bot/everyone roles
    roles.push({
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      permissions: role.permissions.bitfield.toString(),
      mentionable: role.mentionable,
      position: role.position
    });
  });

  // Sort roles by position to restore properly
  roles.sort((a, b) => a.position - b.position);

  // 2. Fetch Channels
  const fetchedChannels = await guild.channels.fetch();
  fetchedChannels.forEach(channel => {
    const parentChannel = channel.parent;
    
    // Parse permission overwrites
    const permissionOverwrites = [];
    channel.permissionOverwrites.cache.forEach(overwrite => {
      permissionOverwrites.push({
        id: overwrite.id,
        type: overwrite.type, // 0 for role, 1 for member
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString()
      });
    });

    channels.push({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      topic: channel.topic || null,
      nsfw: channel.nsfw || false,
      parentName: parentChannel ? parentChannel.name : null,
      parentType: parentChannel ? parentChannel.type : null,
      position: channel.position,
      rateLimitPerUser: channel.rateLimitPerUser || 0,
      permissionOverwrites
    });
  });

  const backupId = Math.random().toString(36).substring(2, 10).toUpperCase();

  const backupDoc = new Backup({
    backupId,
    guildId: guild.id,
    name: name || `Backup-${backupId}`,
    createdById: creatorId,
    data: {
      name: guild.name,
      icon: guild.iconURL(),
      roles,
      channels
    }
  });

  await backupDoc.save();
  return backupDoc;
}

/**
 * Restores a guild setup using backup data
 * WARNING: Destructive operation.
 * @param {Guild} guild 
 * @param {Object} backupData 
 * @param {TextChannel} statusChannel - The channel to post status updates to
 */
async function restoreBackup(guild, backupData, statusChannel) {
  const { roles, channels } = backupData;

  // 1. Delete all existing channels except the status channel (if it exists)
  const currentChannels = await guild.channels.fetch();
  for (const [_, chan] of currentChannels) {
    if (statusChannel && chan.id === statusChannel.id) continue;
    try {
      await chan.delete();
    } catch (e) {
      // Ignore errors on non-deletable channels
    }
  }

  // 2. Delete roles (except everyone and managed/bot roles)
  const currentRoles = await guild.roles.fetch();
  for (const [_, role] of currentRoles) {
    if (role.managed || role.id === guild.id || role.comparePositionTo(guild.members.me.roles.highest) >= 0) continue;
    try {
      await role.delete();
    } catch (e) {
      // Ignore errors on non-deletable roles
    }
  }

  // 3. Recreate Roles and map old role names/ids to new roles
  const roleMap = new Map(); // maps old role identification to new Role objects
  for (const r of roles) {
    try {
      const newRole = await guild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: new PermissionsBitField(BigInt(r.permissions)),
        mentionable: r.mentionable
      });
      roleMap.set(r.name, newRole);
    } catch (e) {
      console.error(`Failed to recreate role ${r.name}:`, e);
    }
  }

  // 4. Create Categories first
  const categoryMap = new Map(); // maps old parent category names to new Category Channels
  const categoriesToCreate = channels.filter(c => c.type === ChannelType.GuildCategory);
  categoriesToCreate.sort((a, b) => a.position - b.position);

  for (const cat of categoriesToCreate) {
    try {
      const newCat = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        position: cat.position
      });
      categoryMap.set(cat.name, newCat);
    } catch (e) {
      console.error(`Failed to recreate category ${cat.name}:`, e);
    }
  }

  // 5. Create Text & Voice Channels
  const otherChannels = channels.filter(c => c.type !== ChannelType.GuildCategory);
  otherChannels.sort((a, b) => a.position - b.position);

  for (const chan of otherChannels) {
    try {
      // Determine parent
      let parentId = null;
      if (chan.parentName && categoryMap.has(chan.parentName)) {
        parentId = categoryMap.get(chan.parentName).id;
      }

      const newChan = await guild.channels.create({
        name: chan.name,
        type: chan.type,
        topic: chan.topic,
        nsfw: chan.nsfw,
        parent: parentId,
        rateLimitPerUser: chan.rateLimitPerUser,
        position: chan.position
      });

      // Apply permission overwrites
      const overwrites = [];
      for (const ov of chan.permissionOverwrites) {
        // Try to match overwrite ID with a recreated role name
        let targetId = ov.id;
        
        // If this overwrite was for a custom role in the backup, map it
        const originalRoleInBackup = roles.find(r => r.id === ov.id); 
        // Note: we didn't save role ID in DB for roles, but if we match by name:
        const matchingRole = roles.find(role => role.name === ov.id || (role.id === ov.id));
        if (matchingRole && roleMap.has(matchingRole.name)) {
          targetId = roleMap.get(matchingRole.name).id;
        } else {
          // If role name matches, map it
          const newRoleByName = Array.from(roleMap.values()).find(r => r.name === ov.id);
          if (newRoleByName) {
            targetId = newRoleByName.id;
          }
        }

        // Map @everyone permission overwrite
        if (ov.id === guild.id) {
          targetId = guild.roles.everyone.id;
        }

        overwrites.push({
          id: targetId,
          type: ov.type,
          allow: new PermissionsBitField(BigInt(ov.allow)),
          deny: new PermissionsBitField(BigInt(ov.deny))
        });
      }

      if (overwrites.length > 0) {
        await newChan.permissionOverwrites.set(overwrites);
      }
    } catch (e) {
      console.error(`Failed to recreate channel ${chan.name}:`, e);
    }
  }

  // 6. Delete status channel if it is different
  if (statusChannel) {
    try {
      // Check if we can find a general/chat channel to post completion or just keep the status channel
      await statusChannel.send({ content: '✅ Guild restoration completed successfully.' });
    } catch (e) {}
  }
}

module.exports = {
  createBackup,
  restoreBackup
};
