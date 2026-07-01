const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const Premium = require('../../models/Premium');
const Guild = require('../../models/Guild');
const validators = require('../../utils/validators');

// Simple key generator helper
function generateKey() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    parts.push(Math.random().toString(36).substring(2, 6).toUpperCase());
  }
  return `PREM-${parts.join('-')}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Enterprise premium configuration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('activate')
        .setDescription('Activates a premium license key on this guild')
        .addStringOption(option => option.setName('code').setDescription('The premium key (e.g. PREM-XXXX-XXXX)').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('deactivate')
        .setDescription('Deactivates premium status for this guild')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Displays the premium status of this guild')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('generate')
        .setDescription('Generates a new premium license key (Owner Only)')
        .addIntegerOption(option => option.setName('days').setDescription('Duration in days (e.g. 30, 365)').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Number of keys to generate').setRequired(false))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    let settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new Guild({ guildId: interaction.guild.id });
    }

    // --- Subcommand: Generate (Owner Only) ---
    if (subcommand === 'generate') {
      if (!validators.isOwner(interaction.user.id)) {
        return interaction.reply({ embeds: [embeds.error('Only the bot developer can generate license keys.')], ephemeral: true });
      }

      const days = interaction.options.getInteger('days');
      const amount = interaction.options.getInteger('amount') || 1;
      const keysGenerated = [];

      for (let i = 0; i < amount; i++) {
        const key = generateKey();
        const premDoc = new Premium({
          code: key,
          durationDays: days
        });
        await premDoc.save();
        keysGenerated.push(key);
      }

      const listEmbed = embeds.premium(
        `Generated **${amount}** premium key(s) for **${days} days**:\n\n\`${keysGenerated.join('\n`\n`')}\``,
        '✨ Keys Generated'
      );
      return interaction.reply({ embeds: [listEmbed], ephemeral: true });
    }

    // --- Subcommand: Activate ---
    if (subcommand === 'activate') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [embeds.error('Only Administrators can activate premium status.')], ephemeral: true });
      }

      const codeInput = interaction.options.getString('code').trim().toUpperCase();
      const license = await Premium.findOne({ code: codeInput });

      if (!license) {
        return interaction.reply({ embeds: [embeds.error('Invalid premium key code!')], ephemeral: true });
      }

      if (license.redeemed) {
        return interaction.reply({ embeds: [embeds.error('This key has already been redeemed!')], ephemeral: true });
      }

      // Redeem key
      license.redeemed = true;
      license.redeemedBy = interaction.user.id;
      license.redeemedAt = new Date();
      license.guildId = interaction.guild.id;
      await license.save();

      // Configure guild settings
      const now = new Date();
      const currentExpiry = settings.premiumExpiresAt && settings.premiumExpiresAt > now ? settings.premiumExpiresAt : now;
      settings.isPremium = true;
      settings.premiumExpiresAt = new Date(currentExpiry.getTime() + (license.durationDays * 24 * 60 * 60 * 1000));
      await settings.save();

      const successEmbed = embeds.premium(
        `Premium activated successfully for **${interaction.guild.name}**!\n\n` +
        `**Key Duration:** ${license.durationDays} days\n` +
        `**Subscription Expiry:** <t:${Math.floor(settings.premiumExpiresAt.getTime() / 1000)}:f> (<t:${Math.floor(settings.premiumExpiresAt.getTime() / 1000)}:R>)`,
        '✨ Guild Upgraded'
      );

      return interaction.reply({ embeds: [successEmbed] });
    }

    // --- Subcommand: Deactivate ---
    if (subcommand === 'deactivate') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [embeds.error('Only Administrators can deactivate premium status.')], ephemeral: true });
      }

      if (!settings.isPremium) {
        return interaction.reply({ embeds: [embeds.error('This server does not have an active premium status.')], ephemeral: true });
      }

      settings.isPremium = false;
      settings.premiumExpiresAt = null;
      await settings.save();

      return interaction.reply({ embeds: [embeds.success('Premium status deactivated. Standard tier features restored.')] });
    }

    // --- Subcommand: Status ---
    if (subcommand === 'status') {
      const isPremium = await validators.checkPremium(interaction.guild.id);
      
      if (!isPremium) {
        return interaction.reply({
          embeds: [embeds.info(
            'This server is currently running the **Standard Tier**.\nUpgrade to get access to advanced administrative features.',
            'Subscription Status'
          )]
        });
      }

      const expiryUnix = Math.floor(settings.premiumExpiresAt.getTime() / 1000);
      const embed = embeds.premium(
        `This guild has an active **Enterprise Premium** subscription.\n\n` +
        `**Expiry Date:** <t:${expiryUnix}:f>\n` +
        `**Time Remaining:** <t:${expiryUnix}:R>`,
        '✨ Subscription Status'
      );
      return interaction.reply({ embeds: [embed] });
    }
  }
};
