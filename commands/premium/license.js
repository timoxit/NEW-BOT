const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const Premium = require('../../models/Premium');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Redeem premium licenses')
    .addSubcommand(subcommand =>
      subcommand
        .setName('redeem')
        .setDescription('Redeem a premium license key on this server')
        .addStringOption(option => option.setName('code').setDescription('The premium key (e.g. PREM-XXXX-XXXX)').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'redeem') {
      const codeInput = interaction.options.getString('code').trim().toUpperCase();
      const license = await Premium.findOne({ code: codeInput });

      if (!license) {
        return interaction.reply({ embeds: [embeds.error('Invalid premium key code!')], ephemeral: true });
      }

      if (license.redeemed) {
        return interaction.reply({ embeds: [embeds.error('This key has already been redeemed!')], ephemeral: true });
      }

      let settings = await Guild.findOne({ guildId: interaction.guild.id });
      if (!settings) {
        settings = new Guild({ guildId: interaction.guild.id });
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
        '✨ License Redeemed'
      );

      return interaction.reply({ embeds: [successEmbed] });
    }
  }
};
