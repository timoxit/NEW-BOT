const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const ReactionRole = require('../../models/ReactionRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Configure reaction self-roles panels')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new reaction roles panel')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Channel to send panel in')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(option => option.setName('title').setDescription('Panel title').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Panel description').setRequired(true))
        .addStringOption(option => 
          option.setName('type')
            .setDescription('Interaction type')
            .setRequired(true)
            .addChoices(
              { name: 'Buttons Grid', value: 'button' },
              { name: 'Select Dropdown', value: 'select' }
            )
        )
        .addRoleOption(option => option.setName('role_1').setDescription('Role 1').setRequired(true))
        .addStringOption(option => option.setName('label_1').setDescription('Button/Option label for Role 1').setRequired(false))
        .addStringOption(option => option.setName('emoji_1').setDescription('Emoji for Role 1').setRequired(false))
        
        .addRoleOption(option => option.setName('role_2').setDescription('Role 2').setRequired(false))
        .addStringOption(option => option.setName('label_2').setDescription('Button/Option label for Role 2').setRequired(false))
        .addStringOption(option => option.setName('emoji_2').setDescription('Emoji for Role 2').setRequired(false))

        .addRoleOption(option => option.setName('role_3').setDescription('Role 3').setRequired(false))
        .addStringOption(option => option.setName('label_3').setDescription('Button/Option label for Role 3').setRequired(false))
        .addStringOption(option => option.setName('emoji_3').setDescription('Emoji for Role 3').setRequired(false))

        .addRoleOption(option => option.setName('role_4').setDescription('Role 4').setRequired(false))
        .addStringOption(option => option.setName('label_4').setDescription('Button/Option label for Role 4').setRequired(false))
        .addStringOption(option => option.setName('emoji_4').setDescription('Emoji for Role 4').setRequired(false))

        .addRoleOption(option => option.setName('role_5').setDescription('Role 5').setRequired(false))
        .addStringOption(option => option.setName('label_5').setDescription('Button/Option label for Role 5').setRequired(false))
        .addStringOption(option => option.setName('emoji_5').setDescription('Emoji for Role 5').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit existing reaction roles panel text')
        .addStringOption(option => option.setName('message_id').setDescription('The message ID of the panel').setRequired(true))
        .addStringOption(option => option.setName('title').setDescription('New title').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('New description').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a reaction roles panel')
        .addStringOption(option => option.setName('message_id').setDescription('The message ID of the panel').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // --- Subcommand: Create ---
    if (subcommand === 'create') {
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const type = interaction.options.getString('type');

      // Compile roles list
      const rolesConfig = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role_${i}`);
        if (role) {
          rolesConfig.push({
            roleId: role.id,
            label: interaction.options.getString(`label_${i}`) || role.name,
            emoji: interaction.options.getString(`emoji_${i}`) || null
          });
        }
      }

      if (rolesConfig.length === 0) {
        return interaction.reply({ embeds: [embeds.error('You must specify at least one role.')], ephemeral: true });
      }

      const panelEmbed = embeds.custom({
        title,
        description,
        color: '#5865F2'
      });

      // Construct components
      let componentsRow = new ActionRowBuilder();

      if (type === 'button') {
        rolesConfig.forEach(r => {
          const button = new ButtonBuilder()
            .setCustomId(`rr_btn_${r.roleId}`)
            .setLabel(r.label)
            .setStyle(ButtonStyle.Primary);
          if (r.emoji) {
            button.setEmoji(r.emoji);
          }
          componentsRow.addComponents(button);
        });
      } else if (type === 'select') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`rr_select_${Date.now()}`)
          .setPlaceholder('Select roles to add/remove')
          .setMinValues(0)
          .setMaxValues(rolesConfig.length);

        rolesConfig.forEach(r => {
          const option = new StringSelectMenuOptionBuilder()
            .setLabel(r.label)
            .setValue(r.roleId)
            .setDescription(`Toggles the ${r.label} role`);
          if (r.emoji) {
            option.setEmoji(r.emoji);
          }
          selectMenu.addOptions(option);
        });

        componentsRow.addComponents(selectMenu);
      }

      const panelMessage = await channel.send({
        embeds: [panelEmbed],
        components: [componentsRow]
      });

      // Save config in DB
      // Note: for select menu, we need to save the message ID. We adjust the select menu custom ID in DB to match
      const rrDoc = new ReactionRole({
        guildId: interaction.guild.id,
        channelId: channel.id,
        messageId: panelMessage.id,
        type,
        roles: rolesConfig
      });
      await rrDoc.save();

      // If select menu, update the message components to match message id for matching
      if (type === 'select') {
        componentsRow.components[0].setCustomId(`rr_select_${panelMessage.id}`);
        await panelMessage.edit({ components: [componentsRow] });
      }

      return interaction.reply({ embeds: [embeds.success(`Reaction roles panel created successfully in <#${channel.id}>!`)], ephemeral: true });
    }

    // --- Subcommand: Edit ---
    if (subcommand === 'edit') {
      const messageId = interaction.options.getString('message_id');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');

      const rrDoc = await ReactionRole.findOne({ guildId: interaction.guild.id, messageId });
      if (!rrDoc) {
        return interaction.reply({ embeds: [embeds.error('Reaction roles panel not found in database.')], ephemeral: true });
      }

      try {
        const channel = await interaction.guild.channels.fetch(rrDoc.channelId);
        const message = await channel.messages.fetch(messageId);

        const updatedEmbed = embeds.custom({
          title,
          description,
          color: '#5865F2'
        });

        await message.edit({ embeds: [updatedEmbed] });
        return interaction.reply({ embeds: [embeds.success('Reaction roles panel text updated successfully!')] });
      } catch (err) {
        return interaction.reply({ embeds: [embeds.error(`Failed to update panel message: ${err.message}`)], ephemeral: true });
      }
    }

    // --- Subcommand: Delete ---
    if (subcommand === 'delete') {
      const messageId = interaction.options.getString('message_id');
      const rrDoc = await ReactionRole.findOne({ guildId: interaction.guild.id, messageId });

      if (!rrDoc) {
        return interaction.reply({ embeds: [embeds.error('Reaction roles panel not found.')], ephemeral: true });
      }

      try {
        const channel = await interaction.guild.channels.fetch(rrDoc.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.delete();
      } catch (e) {
        // message might already be deleted
      }

      await ReactionRole.deleteOne({ messageId });
      return interaction.reply({ embeds: [embeds.success('Reaction roles configuration and panel deleted.')] });
    }
  }
};
