const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Server verification administration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configures and enables verification')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Channel where verification panel will be sent')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option => option.setName('role').setDescription('Role to assign upon successful verification').setRequired(true))
        .addStringOption(option => 
          option.setName('type')
            .setDescription('Verification method')
            .setRequired(true)
            .addChoices(
              { name: 'Direct Button Click', value: 'button' },
              { name: 'Math Captcha Modal', value: 'captcha' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('button')
        .setDescription('Sends the verification panel to the current channel')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('captcha')
        .setDescription('Forces verification type to Captcha Modal')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Updates the role assigned upon verification')
        .addRoleOption(option => option.setName('role').setDescription('The verification role').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disables the verification system')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    let settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new Guild({ guildId: interaction.guild.id });
    }

    // --- Subcommand: Setup ---
    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const type = interaction.options.getString('type');

      settings.verification.enabled = true;
      settings.verification.channelId = channel.id;
      settings.verification.roleId = role.id;
      settings.verification.type = type;
      await settings.save();

      // Post the verification panel
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_button')
          .setLabel('Verify')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛡️')
      );

      const panelEmbed = embeds.custom({
        title: 'Server Verification Required',
        description: type === 'captcha' 
          ? 'Click the button below and solve the math equation captcha in the modal to gain full server access.'
          : 'Click the button below to verify yourself and gain full access to the server.',
        color: '#57F287'
      });

      await channel.send({ embeds: [panelEmbed], components: [row] });

      return interaction.reply({
        embeds: [embeds.success(`Verification system successfully configured!\n\n**Channel:** <#${channel.id}>\n**Role:** <@&${role.id}>\n**Type:** \`${type}\``)],
        ephemeral: true
      });
    }

    // Check if configuration exists for other settings
    if (!settings.verification.enabled && subcommand !== 'setup') {
      return interaction.reply({ embeds: [embeds.error('Verification system is not enabled. Run `/verify setup` first.')], ephemeral: true });
    }

    // --- Subcommand: Button ---
    if (subcommand === 'button') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_button')
          .setLabel('Verify')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛡️')
      );

      const panelEmbed = embeds.custom({
        title: 'Verification Required',
        description: settings.verification.type === 'captcha'
          ? 'Solve the math CAPTCHA modal to verify.'
          : 'Click the button below to verify.',
        color: '#57F287'
      });

      await interaction.channel.send({ embeds: [panelEmbed], components: [row] });
      return interaction.reply({ content: 'Verification button panel sent!', ephemeral: true });
    }

    // --- Subcommand: Captcha ---
    if (subcommand === 'captcha') {
      settings.verification.type = 'captcha';
      await settings.save();
      return interaction.reply({ embeds: [embeds.success('Verification type set to math CAPTCHA modal.')] });
    }

    // --- Subcommand: Role ---
    if (subcommand === 'role') {
      const role = interaction.options.getRole('role');
      settings.verification.roleId = role.id;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`Verification role updated to <@&${role.id}>.`)] });
    }

    // --- Subcommand: Disable ---
    if (subcommand === 'disable') {
      settings.verification.enabled = false;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success('Verification system has been disabled.')] });
    }
  }
};
