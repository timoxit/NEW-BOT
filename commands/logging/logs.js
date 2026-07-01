const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

const LOG_EVENT_CHOICES = [
  { name: 'Message Deletions', value: 'messageDelete' },
  { name: 'Message Edits', value: 'messageUpdate' },
  { name: 'Voice Joins/Leaves', value: 'voiceStateUpdate' },
  { name: 'Member Joins', value: 'guildMemberAdd' },
  { name: 'Member Leaves', value: 'guildMemberRemove' },
  { name: 'Member Updates (Nicknames/Timeouts)', value: 'guildMemberUpdate' },
  { name: 'Guild Bans', value: 'guildBanAdd' },
  { name: 'Guild Unbans', value: 'guildBanRemove' },
  { name: 'Channel Changes', value: 'channelCreate' }, // will trigger for create, delete, update
  { name: 'Role Changes', value: 'roleCreate' },       // will trigger for create, delete, update
  { name: 'Emoji Changes', value: 'emojiCreate' }       // will trigger for create, delete, update
];

// Helper to expand 'channelCreate' to all channel sub-events for database saving
const SUB_EVENT_MAP = {
  channelCreate: ['channelCreate', 'channelDelete', 'channelUpdate'],
  roleCreate: ['roleCreate', 'roleDelete', 'roleUpdate'],
  emojiCreate: ['emojiCreate', 'emojiDelete', 'emojiUpdate']
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure guild action logging')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Enables and configures the logs channel')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Channel where log files will be posted')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enables logging for a specific event type')
        .addStringOption(option => 
          option.setName('event')
            .setDescription('Select the event type to log')
            .setRequired(true)
            .addChoices(...LOG_EVENT_CHOICES)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disables logging for a specific event type')
        .addStringOption(option => 
          option.setName('event')
            .setDescription('Select the event type to disable')
            .setRequired(true)
            .addChoices(...LOG_EVENT_CHOICES)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Shows the status of all logging configurations')
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

      settings.logs.enabled = true;
      settings.logs.channelId = channel.id;
      // Default enable all if empty
      if (settings.logs.events.length === 0) {
        const allEvents = LOG_EVENT_CHOICES.map(c => c.value);
        const expanded = [];
        allEvents.forEach(ev => {
          if (SUB_EVENT_MAP[ev]) {
            expanded.push(...SUB_EVENT_MAP[ev]);
          } else {
            expanded.push(ev);
          }
        });
        settings.logs.events = expanded;
      }
      await settings.save();

      return interaction.reply({
        embeds: [embeds.success(`Logging configured successfully!\n\n**Channel:** <#${channel.id}>\n**Logging Events Status:** Use \`/logs status\` to view enabled logs.`)]
      });
    }

    if (!settings.logs.enabled && subcommand !== 'setup') {
      return interaction.reply({ embeds: [embeds.error('Logging system is disabled. Run `/logs setup` first.')], ephemeral: true });
    }

    // --- Subcommand: Enable Event ---
    if (subcommand === 'enable') {
      const selected = interaction.options.getString('event');
      const eventsToAdd = SUB_EVENT_MAP[selected] || [selected];

      let addedCount = 0;
      eventsToAdd.forEach(ev => {
        if (!settings.logs.events.includes(ev)) {
          settings.logs.events.push(ev);
          addedCount++;
        }
      });

      if (addedCount === 0) {
        return interaction.reply({ embeds: [embeds.info('That log type is already enabled.')], ephemeral: true });
      }

      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`Successfully enabled logging for: **${selected}**.`)] });
    }

    // --- Subcommand: Disable Event ---
    if (subcommand === 'disable') {
      const selected = interaction.options.getString('event');
      const eventsToRemove = SUB_EVENT_MAP[selected] || [selected];

      const initialLength = settings.logs.events.length;
      settings.logs.events = settings.logs.events.filter(ev => !eventsToRemove.includes(ev));

      if (settings.logs.events.length === initialLength) {
        return interaction.reply({ embeds: [embeds.info('That log type was already disabled.')], ephemeral: true });
      }

      await settings.save();
      return interaction.reply({ embeds: [embeds.success(`Successfully disabled logging for: **${selected}**.`)] });
    }

    // --- Subcommand: Status ---
    if (subcommand === 'status') {
      const activeLogs = [];
      const inactiveLogs = [];

      LOG_EVENT_CHOICES.forEach(choice => {
        const checkEv = choice.value;
        const subEvents = SUB_EVENT_MAP[checkEv] || [checkEv];
        const isEnabled = subEvents.every(ev => settings.logs.events.includes(ev));
        
        if (isEnabled) {
          activeLogs.push(`🔹 **${choice.name}**`);
        } else {
          inactiveLogs.push(`🔸 ~~${choice.name}~~`);
        }
      });

      const embed = embeds.info(
        `**Channel:** <#${settings.logs.channelId}>\n\n` +
        `**Active Logs:**\n${activeLogs.join('\n') || 'None'}\n\n` +
        `**Inactive Logs:**\n${inactiveLogs.join('\n') || 'None'}`,
        'Logging Configurations Status'
      );
      return interaction.reply({ embeds: [embed] });
    }
  }
};
