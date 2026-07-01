const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('Configure goodbye message and settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Enables and configures goodbyes')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Goodbye logs channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(option => 
          option.setName('message')
            .setDescription('Goodbye message (use {user}, {guild}, {memberCount})')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    let settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new Guild({ guildId: interaction.guild.id });
    }

    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');

      settings.goodbye.enabled = true;
      settings.goodbye.channelId = channel.id;
      settings.goodbye.message = message;
      await settings.save();

      return interaction.reply({
        embeds: [embeds.success(`Goodbye system enabled!\n\n**Channel:** <#${channel.id}>\n**Message:** \`${message}\``)]
      });
    }
  }
};
