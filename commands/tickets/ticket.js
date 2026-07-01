const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');
const Ticket = require('../../models/Ticket');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Enterprise Ticket System Administration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configures the ticket system settings')
        .addChannelOption(option => 
          option.setName('category')
            .setDescription('Category where tickets will be created')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption(option => option.setName('support_role').setDescription('Support staff role').setRequired(true))
        .addChannelOption(option => 
          option.setName('logs')
            .setDescription('Channel where transcripts will be sent')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('panel')
        .setDescription('Sends a ticket creation button panel to a channel')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Channel to send the panel in')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(option => option.setName('title').setDescription('Panel embed title').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Panel embed description').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Manually creates a new support ticket')
        .addStringOption(option => option.setName('subject').setDescription('The subject of the ticket').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Closes the current ticket')
        .addStringOption(option => option.setName('reason').setDescription('Reason for closing').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reopen')
        .setDescription('Reopens a closed ticket')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('claim')
        .setDescription('Claims the current ticket')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rename')
        .setDescription('Renames the current ticket channel')
        .addStringOption(option => option.setName('name').setDescription('New channel name').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Adds a user to this ticket channel')
        .addUserOption(option => option.setName('user').setDescription('User to add').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Removes a user from this ticket channel')
        .addUserOption(option => option.setName('user').setDescription('User to remove').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Deletes the current ticket channel immediately')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transcript')
        .setDescription('Generates a text transcript of the current ticket')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('settings')
        .setDescription('Displays current ticket system settings')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    // Commands that don't need database config check: none, all depend on config or current channel
    let settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new Guild({ guildId: interaction.guild.id });
      await settings.save();
    }

    // --- Subcommand: Setup ---
    if (subcommand === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [embeds.error('Only Administrators can run ticket setup.')], ephemeral: true });
      }

      const category = interaction.options.getChannel('category');
      const supportRole = interaction.options.getRole('support_role');
      const logsChan = interaction.options.getChannel('logs');

      settings.tickets.enabled = true;
      settings.tickets.categoryChannelId = category.id;
      settings.tickets.supportRoleId = supportRole.id;
      if (logsChan) {
        settings.tickets.logsChannelId = logsChan.id;
      }
      await settings.save();

      const successEmbed = embeds.success(
        `Ticket system configured successfully.\n\n**Category:** <#${category.id}>\n**Support Role:** <@&${supportRole.id}>\n**Logs Channel:** ${logsChan ? `<#${logsChan.id}>` : 'None'}`
      );
      return interaction.reply({ embeds: [successEmbed] });
    }

    // --- Subcommand: Panel ---
    if (subcommand === 'panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [embeds.error('Only Administrators can send ticket panels.')], ephemeral: true });
      }

      if (!settings.tickets.enabled) {
        return interaction.reply({ embeds: [embeds.error('Ticket system has not been configured yet. Run `/ticket setup` first.')], ephemeral: true });
      }

      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');

      const panelEmbed = embeds.custom({
        title,
        description,
        color: '#5865F2'
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎟️')
      );

      await channel.send({ embeds: [panelEmbed], components: [row] });
      return interaction.reply({ content: `Ticket panel sent successfully to <#${channel.id}>!`, ephemeral: true });
    }

    // --- Subcommand: Settings ---
    if (subcommand === 'settings') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [embeds.error('You need Manage Guild permissions to view ticket settings.')], ephemeral: true });
      }

      const status = settings.tickets.enabled ? '🟢 Enabled' : '🔴 Disabled';
      const infoEmbed = embeds.info(
        `**Status:** ${status}\n` +
        `**Category:** ${settings.tickets.categoryChannelId ? `<#${settings.tickets.categoryChannelId}>` : 'None'}\n` +
        `**Support Role:** ${settings.tickets.supportRoleId ? `<@&${settings.tickets.supportRoleId}>` : 'None'}\n` +
        `**Logs Channel:** ${settings.tickets.logsChannelId ? `<#${settings.tickets.logsChannelId}>` : 'None'}\n` +
        `**Ticket Counter:** \`${settings.tickets.counter}\``,
        'Ticket System Settings'
      );
      return interaction.reply({ embeds: [infoEmbed] });
    }

    // --- All other subcommands require execution in a ticket channel or valid ticket document ---
    const ticketDoc = await Ticket.findOne({ channelId: interaction.channel.id });

    // --- Subcommand: Create ---
    if (subcommand === 'create') {
      if (!settings.tickets.enabled) {
        return interaction.reply({ embeds: [embeds.error('The ticket system is not enabled. Ask an admin to run `/ticket setup`.')], ephemeral: true });
      }

      // Check if user already has an active ticket
      const activeTicket = await Ticket.findOne({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        status: { $in: ['open', 'claimed'] }
      });

      if (activeTicket) {
        return interaction.reply({ embeds: [embeds.error(`You already have an open ticket at <#${activeTicket.channelId}>.`)], ephemeral: true });
      }

      // Create ticket
      settings.tickets.counter += 1;
      await settings.save();

      const subject = interaction.options.getString('subject') || 'No subject';
      const ticketChannelName = `ticket-${settings.tickets.counter.toString().padStart(4, '0')}`;

      const ticketChannel = await interaction.guild.channels.create({
        name: ticketChannelName,
        type: ChannelType.GuildText,
        parent: settings.tickets.categoryChannelId || null,
        permissionOverwrites: [
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
          },
          {
            id: settings.tickets.supportRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles
            ]
          }
        ]
      });

      const newTicket = new Ticket({
        guildId: interaction.guild.id,
        channelId: ticketChannel.id,
        userId: interaction.user.id,
        status: 'open'
      });
      await newTicket.save();

      const ticketEmbed = embeds.info(
        `Welcome <@${interaction.user.id}>. Support staff will assist you shortly.\n\n**Subject:** ${subject}`,
        `Ticket - #${settings.tickets.counter}`
      );

      const controlsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🙋'),
        new ButtonBuilder().setCustomId('ticket_close_prompt').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      await ticketChannel.send({
        content: `<@${interaction.user.id}> | <@&${settings.tickets.supportRoleId}>`,
        embeds: [ticketEmbed],
        components: [controlsRow]
      });

      return interaction.reply({ embeds: [embeds.success(`Ticket created: <#${ticketChannel.id}>`)], ephemeral: true });
    }

    // Verification check for in-ticket commands
    if (!ticketDoc) {
      return interaction.reply({ embeds: [embeds.error('This command can only be used inside a ticket channel.')], ephemeral: true });
    }

    const hasStaffRole = settings.tickets.supportRoleId && interaction.member.roles.cache.has(settings.tickets.supportRoleId);
    const isStaff = hasStaffRole || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    // --- Subcommand: Close ---
    if (subcommand === 'close') {
      const reason = interaction.options.getString('reason') || 'No reason provided';
      
      ticketDoc.status = 'closed';
      ticketDoc.closedBy = interaction.user.id;
      ticketDoc.closedAt = new Date();
      await ticketDoc.save();

      await interaction.reply({ embeds: [embeds.warn(`Ticket will be closed and deleted in 5 seconds. Reason: **${reason}**`)] });

      // Disable view permissions for the ticket author
      try {
        await interaction.channel.permissionOverwrites.edit(ticketDoc.userId, {
          ViewChannel: false
        });
      } catch (err) {}

      // Generate transcript log
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let transcriptText = `Ticket Transcript for #${interaction.channel.name}\nOwner: ${ticketDoc.userId}\nClosed By: ${interaction.user.id}\nReason: ${reason}\n\n`;
        
        messages.reverse().forEach(m => {
          transcriptText += `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}\n`;
        });

        const buffer = Buffer.from(transcriptText, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

        if (settings.tickets.logsChannelId) {
          const logsChan = await interaction.guild.channels.fetch(settings.tickets.logsChannelId);
          if (logsChan) {
            const trEmbed = embeds.info(
              `Ticket: \`#${interaction.channel.name}\`\nUser: <@${ticketDoc.userId}>\nClosed By: <@${interaction.user.id}>\nReason: ${reason}`,
              '📁 Ticket Closed & Logged'
            );
            await logsChan.send({ embeds: [trEmbed], files: [attachment] });
          }
        }
      } catch (e) {
        logger.error('Failed to log closed ticket transcript:', e);
      }

      // Delete channel
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (e) {}
      }, 5000);
      return;
    }

    // --- Subcommand: Reopen ---
    if (subcommand === 'reopen') {
      if (!isStaff) {
        return interaction.reply({ embeds: [embeds.error('Only staff members can reopen tickets.')], ephemeral: true });
      }

      ticketDoc.status = 'open';
      ticketDoc.closedBy = null;
      ticketDoc.closedAt = null;
      await ticketDoc.save();

      // Restore user permissions
      try {
        await interaction.channel.permissionOverwrites.edit(ticketDoc.userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      } catch (err) {}

      return interaction.reply({ embeds: [embeds.success('Ticket has been reopened.')] });
    }

    // --- Subcommand: Claim ---
    if (subcommand === 'claim') {
      if (!isStaff) {
        return interaction.reply({ embeds: [embeds.error('Only staff members can claim tickets.')], ephemeral: true });
      }

      if (ticketDoc.status === 'claimed') {
        return interaction.reply({ embeds: [embeds.error(`This ticket is already claimed by <@${ticketDoc.claimedBy}>.`)], ephemeral: true });
      }

      ticketDoc.status = 'claimed';
      ticketDoc.claimedBy = interaction.user.id;
      await ticketDoc.save();

      return interaction.reply({ embeds: [embeds.success(`Ticket claimed by <@${interaction.user.id}>.`)] });
    }

    // --- Subcommand: Rename ---
    if (subcommand === 'rename') {
      if (!isStaff) {
        return interaction.reply({ embeds: [embeds.error('Only staff members can rename tickets.')], ephemeral: true });
      }

      const newName = interaction.options.getString('name').toLowerCase();
      try {
        await interaction.channel.setName(newName);
        return interaction.reply({ embeds: [embeds.success(`Channel renamed to **${newName}**.`)] });
      } catch (err) {
        return interaction.reply({ embeds: [embeds.error(`Failed to rename channel: ${err.message}`)], ephemeral: true });
      }
    }

    // --- Subcommand: Add User ---
    if (subcommand === 'add') {
      if (!isStaff) {
        return interaction.reply({ embeds: [embeds.error('Only staff members can add users to tickets.')], ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      try {
        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true
        });
        return interaction.reply({ embeds: [embeds.success(`Added <@${targetUser.id}> to the ticket.`)] });
      } catch (err) {
        return interaction.reply({ embeds: [embeds.error(`Failed to add user: ${err.message}`)], ephemeral: true });
      }
    }

    // --- Subcommand: Remove User ---
    if (subcommand === 'remove') {
      if (!isStaff) {
        return interaction.reply({ embeds: [embeds.error('Only staff members can remove users from tickets.')], ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      try {
        await interaction.channel.permissionOverwrites.delete(targetUser.id);
        return interaction.reply({ embeds: [embeds.success(`Removed <@${targetUser.id}> from the ticket.`)] });
      } catch (err) {
        return interaction.reply({ embeds: [embeds.error(`Failed to remove user: ${err.message}`)], ephemeral: true });
      }
    }

    // --- Subcommand: Delete Channel ---
    if (subcommand === 'delete') {
      if (!isStaff) {
        return interaction.reply({ embeds: [embeds.error('Only staff members can delete tickets.')], ephemeral: true });
      }

      await interaction.reply({ content: 'Deleting ticket channel immediately...' });
      await Ticket.deleteOne({ channelId: interaction.channel.id });
      try {
        await interaction.channel.delete();
      } catch (e) {}
      return;
    }

    // --- Subcommand: Transcript ---
    if (subcommand === 'transcript') {
      await interaction.deferReply();
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let transcriptText = `Ticket Transcript for #${interaction.channel.name}\nOwner: ${ticketDoc.userId}\nDate Generated: ${new Date().toISOString()}\n\n`;
        
        messages.reverse().forEach(m => {
          transcriptText += `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}\n`;
        });

        const buffer = Buffer.from(transcriptText, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

        return interaction.editReply({
          content: 'Here is the transcript for this ticket:',
          files: [attachment]
        });
      } catch (err) {
        return interaction.editReply({ embeds: [embeds.error(`Failed to generate transcript: ${err.message}`)] });
      }
    }
  }
};
