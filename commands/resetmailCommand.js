const { clearEmail, getEmail } = require('./tempMailStore');

async function resetmailCommand(sock, chatId, msg) {
    try {
        const existing = getEmail(chatId);

        if (!existing) {
            await sock.sendMessage(chatId, {
                text: '❌ Koi active temp email nahi hai reset karne ke liye. *.tmp* se naya banayein.'
            }, { quoted: msg });
            return;
        }

        clearEmail(chatId);

        await sock.sendMessage(chatId, {
            text: `🔄 *Reset Successful!*\n\nPurana email \`${existing}\` clear kar diya gaya.\n\nNaya email banane ke liye: *.tmp*`
        }, { quoted: msg });
    } catch (error) {
        console.error('Error in resetmail command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to reset temp email.\n\n_Debug: ${error.message || error}_`
        }, { quoted: msg });
    }
}

module.exports = resetmailCommand;