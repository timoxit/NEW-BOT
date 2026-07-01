const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Automated moderation settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enables the AutoMod system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disables the AutoMod system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('antispam')
        .setDescription('Toggle message spam detection')
        .addBooleanOption(option => option.setName('enabled').setDescription('Toggle on/off').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('antiinvite')
        .setDescription('Toggle invite link blocking')
        .addBooleanOption(option => option.setName('enabled').setDescription('Toggle on/off').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('antilink')
        .setDescription('Toggle external links blocking')
        .addBooleanOption(option => option.setName('enabled').setDescription('Toggle on/off').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('badwords')
        .setDescription('Manage blacklisted words')
        .addStringOption(option => 
          option.setName('action')
            .setDescription('Select action')
            .setRequired(true)
            .addChoices(
              { name: 'Add Word(s)', value: 'add' },
              { name: 'Remove Word(s)', value: 'remove' },
              { name: 'List Words', value: 'list' }
            )
        )
        .addStringOption(option => option.setName('words').setDescription('Comma separated words (not required for list)').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('mentionlimit')
        .setDescription('Set maximum user/role mentions per message')
        .addIntegerOption(option => option.setName('limit').setDescription('Number of mentions allowed (0 to disable)').setRequired(true).setMinValue(0))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('antiraid')
        .setDescription('Toggle anti-raid protection (prevents new joins)')
        .addBooleanOption(option => option.setName('enabled').setDescription('Toggle on/off').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('punishment')
        .setDescription('Sets the default punishment for AutoMod violations')
        .addStringOption(option => 
          option.setName('action')
            .setDescription('Select punishment')
            .setRequired(true)
            .addChoices(
              { name: 'Warn User', value: 'warn' },
              { name: '10 min Timeout', value: 'timeout' },
              { name: 'Kick User', value: 'kick' },
              { name: 'Ban User', value: 'ban' }
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    let settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new Guild({ guildId: interaction.guild.id });
    }

    // --- Subcommand: Enable/Disable ---
    if (subcommand === 'enable') {
      settings.automod.enabled = true;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success('AutoMod has been enabled for this server.')] });
    }

    if (subcommand === 'disable') {
      settings.automod.enabled = false;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success('AutoMod has been disabled.')] });
    }

    // Settings config
    if (!settings.automod.enabled && subcommand !== 'enable') {
      return interaction.reply({ embeds: [embeds.error('AutoMod is currently disabled. Enable it with `/automod enable`.')], ephemeral: true });
    }

    // --- Subcommand: Antispam ---
    if (subcommand === 'antispam') {
      const enabled = interaction.options.getBoolean('enabled');
      settings.automod.antispam = enabled;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`AutoMod Spam filter is now **${enabled ? 'Enabled' : 'Disabled'}**.`)] });
    }

    // --- Subcommand: Antiinvite ---
    if (subcommand === 'antiinvite') {
      const enabled = interaction.options.getBoolean('enabled');
      settings.automod.antiinvite = enabled;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`AutoMod Invite blocker is now **${enabled ? 'Enabled' : 'Disabled'}**.`)] });
    }

    // --- Subcommand: Antilink ---
    if (subcommand === 'antilink') {
      const enabled = interaction.options.getBoolean('enabled');
      settings.automod.antilink = enabled;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`AutoMod Link blocker is now **${enabled ? 'Enabled' : 'Disabled'}**.`)] });
    }

    // --- Subcommand: Badwords ---
    if (subcommand === 'badwords') {
      const action = interaction.options.getString('action');
      const wordsStr = interaction.options.getString('words');

      if (action === 'list') {
        const words = settings.automod.badwords;
        if (words.length === 0) {
          return interaction.reply({ embeds: [embeds.info('There are no blacklisted words.')] });
        }
        return interaction.reply({ embeds: [embeds.info(`**Blacklisted Words:**\n\`${words.join('`, `')}\``)] });
      }

      if (!wordsStr) {
        return interaction.reply({ embeds: [embeds.error('You must specify words to add or remove.')], ephemeral: true });
      }

      const inputWords = wordsStr.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);

      if (action === 'add') {
        const added = [];
        inputWords.forEach(word => {
          if (!settings.automod.badwords.includes(word)) {
            settings.automod.badwords.push(word);
            added.push(word);
          }
        });
        await settings.save();
        return interaction.reply({ embeds: [embeds.success(`Successfully added words to blacklist: \`${added.join('`, `')}\`.`)] });
      }

      if (action === 'remove') {
        const initialLength = settings.automod.badwords.length;
        settings.automod.badwords = settings.automod.badwords.filter(word => !inputWords.includes(word));
        await settings.save();
        const removedCount = initialLength - settings.automod.badwords.length;
        return interaction.reply({ embeds: [embeds.success(`Successfully removed **${removedCount}** words from blacklist.`)] });
      }
    }

    // --- Subcommand: MentionLimit ---
    if (subcommand === 'mentionlimit') {
      const limit = interaction.options.getInteger('limit');
      settings.automod.mentionLimit = limit;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(limit === 0 ? 'Mention limit disabled.' : `AutoMod mention limit set to **${limit} mentions** per message.`)] });
    }

    // --- Subcommand: Antiraid ---
    if (subcommand === 'antiraid') {
      const enabled = interaction.options.getBoolean('enabled');
      settings.automod.antiraid = enabled;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`AutoMod Anti-Raid protection is now **${enabled ? 'Enabled (locking joins)' : 'Disabled'}**.`)] });
    }

    // --- Subcommand: Punishment ---
    if (subcommand === 'punishment') {
      const action = interaction.options.getString('action');
      settings.automod.punishment = action;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`AutoMod default violation action set to **${action.toUpperCase()}**.`)] });
    }
  }
};
