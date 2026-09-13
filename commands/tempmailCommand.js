const { setEmail } = require('./tempMailStore');

async function tempmailCommand(sock, chatId, msg) {
    try {
        const randomName = Math.random().toString(36).substring(2, 10);
        const email = `${randomName}@catchmail.io`;

        setEmail(chatId, email);

        await sock.sendMessage(chatId, {
            text:
                `✅ *Temporary Email Created*\n\n` +
                `📧 \`${email}\`\n\n` +
                `_Inbox check karne ke liye: *.tmpib*_`
        }, { quoted: msg });
    } catch (error) {
        console.error('Error in tempmail command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to generate temp mail.\n\n_Debug: ${error.message || error}_`
        }, { quoted: msg });
    }
}

module.exports = tempmailCommand;