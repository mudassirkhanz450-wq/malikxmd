const settings = require('../settings');

async function ownerCommand(sock, from, msg) {
    const ownerText =
        "◤━━━━━━━━━━━━━━━◥\n" +
        "   👤 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢\n" +
        "◣━━━━━━━━━━━━━━━◢\n\n" +
        " ▸ Name    : " + settings.ownerName + "\n" +
        " ▸ Number  : +" + settings.ownerNumber + "\n" +
        " ▸ Channel : " + settings.channelLink + "\n\n" +
        " ➤ Reach out via WhatsApp Channel above 📢\n\n" +
        " ⟦ 👑 " + settings.botName + " ⟧";
    await sock.sendMessage(from, { text: ownerText }, { quoted: msg });
}

module.exports = ownerCommand;
