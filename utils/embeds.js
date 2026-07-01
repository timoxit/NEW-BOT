const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary: '#5865F2', // Blurple
  success: '#57F287', // Emerald Green
  danger: '#ED4245',  // Crimson
  warning: '#FEE75C', // Yellow
  premium: '#EB459E', // Hot Pink
  dark: '#2B2D31'     // Discord Gray
};

function createEmbed({
  title = null,
  description = null,
  color = COLORS.primary,
  fields = [],
  thumbnail = null,
  image = null,
  footer = null,
  author = null,
  timestamp = true
}) {
  const embed = new EmbedBuilder().setColor(color);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields && fields.length > 0) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (timestamp) embed.setTimestamp();

  if (author) {
    embed.setAuthor({
      name: author.name,
      iconURL: author.iconURL || author.iconUrl || undefined,
      url: author.url || undefined
    });
  }

  if (footer) {
    embed.setFooter({
      text: footer.text,
      iconURL: footer.iconURL || footer.iconUrl || undefined
    });
  } else {
    embed.setFooter({ text: 'Enterprise Services • Antigravity' });
  }

  return embed;
}

module.exports = {
  COLORS,
  success: (description, title = '✅ Success', fields = []) => createEmbed({ title, description, color: COLORS.success, fields }),
  error: (description, title = '❌ Error', fields = []) => createEmbed({ title, description, color: COLORS.danger, fields }),
  warn: (description, title = '⚠️ Warning', fields = []) => createEmbed({ title, description, color: COLORS.warning, fields }),
  premium: (description, title = '✨ Premium Feature', fields = []) => createEmbed({ title, description, color: COLORS.premium, fields }),
  info: (description, title = 'ℹ️ Information', fields = []) => createEmbed({ title, description, color: COLORS.primary, fields }),
  custom: createEmbed
};
