const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function getCommand(sock, from, msg) {
    try {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return await sock.sendMessage(from, { text: 'Reply to a WhatsApp status message.' }, { quoted: msg });
        }

        const message = quoted.ephemeralMessage?.message ||
            quoted.viewOnceMessage?.message ||
            quoted.viewOnceMessageV2?.message ||
            quoted;

        const text = message.conversation || message.extendedTextMessage?.text || '';
        if (text) {
            return await sock.sendMessage(from, { text }, { quoted: msg });
        }

        const type = Object.keys(message || {}).find(key => ['imageMessage', 'videoMessage'].includes(key));
        if (!type) {
            return await sock.sendMessage(from, { text: 'The replied status has no supported media or text.' }, { quoted: msg });
        }

        const stream = await downloadContentFromMessage(message[type], type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const caption = message[type].caption || 'Downloaded status';
        if (type === 'imageMessage') {
            await sock.sendMessage(from, { image: buffer, caption }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { video: buffer, caption }, { quoted: msg });
        }
    } catch (error) {
        await sock.sendMessage(from, { text: `Could not download status: ${error.message}` }, { quoted: msg });
    }
}

module.exports = getCommand;
