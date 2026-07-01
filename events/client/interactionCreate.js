const { InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const embeds = require('../../utils/embeds');
const validators = require('../../utils/validators');
const Guild = require('../../models/Guild');
const User = require('../../models/User');
const Ticket = require('../../models/Ticket');
const Giveaway = require('../../models/Giveaway');
const ReactionRole = require('../../models/ReactionRole');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        // Cooldowns checks can go here (simplified for space)
        
        // Owner only check
        if (command.ownerOnly && !validators.isOwner(interaction.user.id)) {
          return interaction.reply({
            embeds: [embeds.error('This command can only be used by the bot developer.')],
            ephemeral: true
          });
        }

        // Premium only check
        if (command.premiumOnly) {
          const isPremium = await validators.checkPremium(interaction.guildId);
          if (!isPremium) {
            return interaction.reply({
              embeds: [embeds.premium('This feature requires an active server premium license. You can activate it using `/premium activate <code>`.')],
              ephemeral: true
            });
          }
        }

        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);
        const replyPayload = {
          embeds: [embeds.error('There was an error while executing this command!')],
          ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload).catch(() => {});
        } else {
          await interaction.reply(replyPayload).catch(() => {});
        }
      }
      return;
    }

    // 2. Buttons Handling
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // --- Welcome Page / Verification Setup ---
      if (customId === 'verify_button') {
        try {
          const settings = await Guild.findOne({ guildId: interaction.guild.id });
          if (!settings || !settings.verification.enabled) {
            return interaction.reply({ content: 'Verification is currently disabled.', ephemeral: true });
          }

          // Check if user already has verification role
          const role = interaction.guild.roles.cache.get(settings.verification.roleId);
          if (!role) {
            return interaction.reply({ content: 'Verification role not found. Please contact support.', ephemeral: true });
          }

          if (interaction.member.roles.cache.has(role.id)) {
            return interaction.reply({ content: 'You are already verified!', ephemeral: true });
          }

          if (settings.verification.type === 'button') {
            // Instant verification
            await interaction.member.roles.add(role);
            return interaction.reply({ content: '✅ You have been verified successfully!', ephemeral: true });
          } else if (settings.verification.type === 'captcha') {
            // Math equation captcha modal
            const num1 = Math.floor(Math.random() * 10) + 1;
            const num2 = Math.floor(Math.random() * 10) + 1;
            const answer = num1 + num2;

            const modal = new ModalBuilder()
              .setCustomId(`verify_modal_${answer}`)
              .setTitle('Server Captcha Verification');

            const equationInput = new TextInputBuilder()
              .setCustomId('captcha_input')
              .setLabel(`Solve: ${num1} + ${num2} = ?`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Type the correct number')
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(equationInput));
            await interaction.showModal(modal);
          }
        } catch (err) {
          logger.error('Error handling verify button:', err);
        }
        return;
      }

      // --- Giveaway Entries ---
      if (customId.startsWith('giveaway_enter_')) {
        const messageId = customId.split('_')[2];
        try {
          const giveaway = await Giveaway.findOne({ messageId });
          if (!giveaway || giveaway.ended) {
            return interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
          }
          if (giveaway.paused) {
            return interaction.reply({ content: 'This giveaway is currently paused.', ephemeral: true });
          }

          if (giveaway.enteredUsers.includes(interaction.user.id)) {
            // Leave giveaway
            giveaway.enteredUsers = giveaway.enteredUsers.filter(id => id !== interaction.user.id);
            await giveaway.save();

            // Update user interface entry count
            const embed = interaction.message.embeds[0];
            if (embed) {
              const updatedEmbed = {
                ...embed.toJSON(),
                description: `React with 🎉 to enter!\nHosted by: <@${giveaway.hostedBy}>\nEntries: **${giveaway.enteredUsers.length}**`
              };
              await interaction.message.edit({ embeds: [updatedEmbed] });
            }

            return interaction.reply({ content: '❌ You have left the giveaway.', ephemeral: true });
          } else {
            // Join giveaway
            giveaway.enteredUsers.push(interaction.user.id);
            await giveaway.save();

            // Update user interface entry count
            const embed = interaction.message.embeds[0];
            if (embed) {
              const updatedEmbed = {
                ...embed.toJSON(),
                description: `React with 🎉 to enter!\nHosted by: <@${giveaway.hostedBy}>\nEntries: **${giveaway.enteredUsers.length}**`
              };
              await interaction.message.edit({ embeds: [updatedEmbed] });
            }

            return interaction.reply({ content: '🎉 You have successfully entered the giveaway!', ephemeral: true });
          }
        } catch (err) {
          logger.error('Error entering giveaway:', err);
        }
        return;
      }

      // --- Ticket Panel Create Button ---
      if (customId === 'ticket_open') {
        try {
          const settings = await Guild.findOne({ guildId: interaction.guild.id });
          if (!settings || !settings.tickets.enabled) {
            return interaction.reply({ content: 'Ticket system is currently disabled.', ephemeral: true });
          }

          // Check if ticket already open for this user
          const existingTicket = await Ticket.findOne({
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            status: { $in: ['open', 'claimed'] }
          });

          if (existingTicket) {
            return interaction.reply({ content: `You already have an open ticket: <#${existingTicket.channelId}>`, ephemeral: true });
          }

          // Create ticket channel
          settings.tickets.counter += 1;
          await settings.save();

          const ticketChannelName = `ticket-${settings.tickets.counter.toString().padStart(4, '0')}`;
          
          const parentCategory = settings.tickets.categoryChannelId;
          const overwrites = [
            {
              id: interaction.guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles
              ]
            }
          ];

          if (settings.tickets.supportRoleId) {
            overwrites.push({
              id: settings.tickets.supportRoleId,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles
              ]
            });
          }

          const ticketChannel = await interaction.guild.channels.create({
            name: ticketChannelName,
            type: ChannelType.GuildText,
            parent: parentCategory || null,
            permissionOverwrites: overwrites
          });

          const ticketDoc = new Ticket({
            guildId: interaction.guild.id,
            channelId: ticketChannel.id,
            userId: interaction.user.id,
            status: 'open'
          });
          await ticketDoc.save();

          // Send control panel in ticket channel
          const ticketEmbed = embeds.info(
            `Welcome to your support ticket, <@${interaction.user.id}>.\nPlease describe your issue, and staff will be with you shortly.`,
            `Support Ticket - #${settings.tickets.counter}`
          );

          const controlsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🙋'),
            new ButtonBuilder().setCustomId('ticket_close_prompt').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
          );

          await ticketChannel.send({
            content: `<@${interaction.user.id}> | <@&${settings.tickets.supportRoleId || ''}>`,
            embeds: [ticketEmbed],
            components: [controlsRow]
          });

          return interaction.reply({ content: `🎟️ Ticket created successfully! Go to <#${ticketChannel.id}>`, ephemeral: true });
        } catch (err) {
          logger.error('Error creating ticket:', err);
          return interaction.reply({ content: 'An error occurred while creating your ticket.', ephemeral: true });
        }
      }

      // --- Ticket Channel Operation Buttons ---
      if (customId === 'ticket_claim') {
        try {
          const settings = await Guild.findOne({ guildId: interaction.guild.id });
          const hasSupport = settings && settings.tickets.supportRoleId && interaction.member.roles.cache.has(settings.tickets.supportRoleId);
          const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

          if (!hasSupport && !isAdmin) {
            return interaction.reply({ content: 'Only support staff can claim tickets.', ephemeral: true });
          }

          const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
          if (!ticket) return interaction.reply({ content: 'This channel is not a ticket or not in the database.', ephemeral: true });
          if (ticket.status === 'claimed') return interaction.reply({ content: 'This ticket has already been claimed.', ephemeral: true });

          ticket.status = 'claimed';
          ticket.claimedBy = interaction.user.id;
          await ticket.save();

          // Update UI
          await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            SendMessages: true,
            ViewChannel: true
          });

          const embed = embeds.success(`Ticket claimed by <@${interaction.user.id}>. This agent will assist you now.`);
          await interaction.reply({ embeds: [embed] });
        } catch (err) {
          logger.error('Error claiming ticket:', err);
        }
        return;
      }

      if (customId === 'ticket_close_prompt') {
        // Prompts with modal for reason
        const modal = new ModalBuilder()
          .setCustomId('ticket_close_modal')
          .setTitle('Close Support Ticket');

        const reasonInput = new TextInputBuilder()
          .setCustomId('ticket_close_reason')
          .setLabel('Reason for closure')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter reason (optional)')
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
      }

      // --- Reaction Roles Buttons ---
      if (customId.startsWith('rr_btn_')) {
        const roleId = customId.split('_')[2];
        try {
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) return interaction.reply({ content: 'Role not found.', ephemeral: true });

          if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            return interaction.reply({ content: `Removed the **${role.name}** role.`, ephemeral: true });
          } else {
            await interaction.member.roles.add(role);
            return interaction.reply({ content: `Assigned the **${role.name}** role.`, ephemeral: true });
          }
        } catch (err) {
          logger.error('Error toggling reaction role button:', err);
          return interaction.reply({ content: 'Failed to update roles.', ephemeral: true });
        }
      }
    }

    // 3. Select Menus Handling
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      if (customId.startsWith('rr_select_')) {
        const values = interaction.values; // roleIds selected
        try {
          const rrDoc = await ReactionRole.findOne({ messageId: interaction.message.id });
          if (!rrDoc) return interaction.reply({ content: 'Configuration not found.', ephemeral: true });

          const allRoleIds = rrDoc.roles.map(r => r.roleId);
          
          // Remove all configuration roles the user currently has
          const rolesToRemove = allRoleIds.filter(id => interaction.member.roles.cache.has(id));
          if (rolesToRemove.length > 0) {
            await interaction.member.roles.remove(rolesToRemove);
          }

          // Add the newly selected roles
          const rolesToAdd = values.filter(id => !interaction.member.roles.cache.has(id));
          if (rolesToAdd.length > 0) {
            await interaction.member.roles.add(rolesToAdd);
          }

          return interaction.reply({ content: 'Roles updated successfully!', ephemeral: true });
        } catch (err) {
          logger.error('Error in reaction role select menu:', err);
          return interaction.reply({ content: 'Failed to update roles.', ephemeral: true });
        }
      }
    }

    // 4. Modals Handling
    if (interaction.type === InteractionType.ModalSubmit) {
      const customId = interaction.customId;

      // Verification CAPTCHA Solver
      if (customId.startsWith('verify_modal_')) {
        const expected = parseInt(customId.split('_')[2], 10);
        const inputVal = parseInt(interaction.fields.getTextInputValue('captcha_input').trim(), 10);

        if (inputVal === expected) {
          try {
            const settings = await Guild.findOne({ guildId: interaction.guild.id });
            const role = interaction.guild.roles.cache.get(settings.verification.roleId);
            if (role) {
              await interaction.member.roles.add(role);
              return interaction.reply({ content: '✅ Captcha solved! Verification successful.', ephemeral: true });
            }
          } catch (e) {
            return interaction.reply({ content: 'Failed to apply verified role.', ephemeral: true });
          }
        } else {
          return interaction.reply({ content: '❌ Incorrect answer. Please try again.', ephemeral: true });
        }
      }

      // Ticket Close Reason
      if (customId === 'ticket_close_modal') {
        const reason = interaction.fields.getTextInputValue('ticket_close_reason') || 'No reason specified';
        try {
          const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
          if (!ticket) return interaction.reply({ content: 'This is not a registered ticket.', ephemeral: true });

          ticket.status = 'closed';
          ticket.closedBy = interaction.user.id;
          ticket.closedAt = new Date();
          await ticket.save();

          await interaction.reply({ content: `Ticket will close shortly... Reason: ${reason}` });

          // Disable channel permissions for the user
          try {
            await interaction.channel.permissionOverwrites.edit(ticket.userId, {
              ViewChannel: false
            });
          } catch (err) {}

          // Generate Simple Transcript (Plain Text)
          const messages = await interaction.channel.messages.fetch({ limit: 100 });
          let transcriptText = `Ticket Transcript for #${interaction.channel.name}\nOwner: ${ticket.userId}\nClosed By: ${interaction.user.id}\nReason: ${reason}\n\n`;
          
          messages.reverse().forEach(m => {
            transcriptText += `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}\n`;
          });

          const buffer = Buffer.from(transcriptText, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

          // Send transcript to Logs Channel if configured
          const settings = await Guild.findOne({ guildId: interaction.guild.id });
          if (settings && settings.tickets.logsChannelId) {
            try {
              const logsChan = await interaction.guild.channels.fetch(settings.tickets.logsChannelId);
              if (logsChan) {
                const trEmbed = embeds.info(
                  `Ticket: \`#${interaction.channel.name}\`\nUser: <@${ticket.userId}>\nClosed By: <@${interaction.user.id}>\nReason: ${reason}`,
                  '📁 Ticket Closed & Logged'
                );
                await logsChan.send({ embeds: [trEmbed], files: [attachment] });
              }
            } catch (e) {
              logger.error('Failed to send transcript to logs channel:', e);
            }
          }

          // Delete ticket channel after 5 seconds
          setTimeout(async () => {
            try {
              await interaction.channel.delete();
            } catch (e) {}
          }, 5000);

        } catch (err) {
          logger.error('Error closing ticket:', err);
        }
      }
    }
  }
};
