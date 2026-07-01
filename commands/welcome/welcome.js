const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome message and settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Enables and configures welcomes')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Welcome logs channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option => option.setName('autorole').setDescription('Auto-assigned role for new members').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed')
        .setDescription('Customize the welcome embed message')
        .addStringOption(option => option.setName('title').setDescription('Embed title (use {user}, {memberCount}, {guild})').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Embed description (use {user}, {memberCount}, {guild})').setRequired(true))
        .addStringOption(option => option.setName('color').setDescription('Hex color code (e.g. #FF0000)').setRequired(false))
        .addBooleanOption(option => option.setName('thumbnail').setDescription('Show user avatar as thumbnail').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Change the welcome channel')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Welcome logs channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('autorole')
        .setDescription('Set or disable welcome autorole')
        .addRoleOption(option => option.setName('role').setDescription('Role to assign (leave blank to disable)').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    let settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new Guild({ guildId: interaction.guild.id });
    }

    // --- Subcommand: Setup ---
    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const autorole = interaction.options.getRole('autorole');

      settings.welcome.enabled = true;
      settings.welcome.channelId = channel.id;
      if (autorole) {
        settings.welcome.autoRoleId = autorole.id;
      }
      await settings.save();

      return interaction.reply({
        embeds: [embeds.success(`Welcome settings enabled!\n\n**Channel:** <#${channel.id}>\n**Auto-Role:** ${autorole ? `<@&${autorole.id}>` : 'None'}`)]
      });
    }

    // Check if welcome enabled
    if (!settings.welcome.enabled && subcommand !== 'setup') {
      return interaction.reply({ embeds: [embeds.error('Welcome system is not enabled. Run `/welcome setup` first.')], ephemeral: true });
    }

    // --- Subcommand: Embed Customization ---
    if (subcommand === 'embed') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color') || '#5865F2';
      const thumbnail = interaction.options.getBoolean('thumbnail') !== null ? interaction.options.getBoolean('thumbnail') : true;

      // Validate hex color
      const hexRegex = /^#([A-Fa-f0-9]{6})$/;
      if (!hexRegex.test(color)) {
        return interaction.reply({ embeds: [embeds.error('Invalid hex color format. Example: `#5865F2`')], ephemeral: true });
      }

      settings.welcome.embedTitle = title;
      settings.welcome.embedDesc = description;
      settings.welcome.embedColor = color;
      settings.welcome.thumbnail = thumbnail;
      await settings.save();

      return interaction.reply({ embeds: [embeds.success('Welcome embed customized successfully!')] });
    }

    // --- Subcommand: Channel Update ---
    if (subcommand === 'channel') {
      const channel = interaction.options.getChannel('channel');
      settings.welcome.channelId = channel.id;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`Welcome logs channel updated to <#${channel.id}>.`)] });
    }

    // --- Subcommand: Autorole Update ---
    if (subcommand === 'autorole') {
      const role = interaction.options.getRole('role');
      settings.welcome.autoRoleId = role ? role.id : null;
      await settings.save();

      return interaction.reply({
        embeds: [embeds.success(role ? `Welcome auto-role updated to <@&${role.id}>.` : 'Welcome auto-role disabled.')]
      });
    }
  }
};
