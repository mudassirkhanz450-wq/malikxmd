const fetch = require('node-fetch');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');

async function rmbgCommand(sock, chatId, msg) {
    try {
        // Find the target image: either sent directly with caption .rmbg,
        // or a reply to someone else's image message.
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        let targetImageMessage = null;
        if (msg.message?.imageMessage) {
            targetImageMessage = msg.message.imageMessage;
        } else if (quoted?.imageMessage) {
            targetImageMessage = quoted.imageMessage;
        }

        if (!targetImageMessage) {
            await sock.sendMessage(chatId, {
                text: '🖼️ *Usage:* Kisi image ko reply karke *.rmbg* likho, ya image bhejte waqt caption mein *.rmbg* likho.'
            }, { quoted: msg });
            return;
        }

        const apiKey = settings.removeBgApiKey;
        if (!apiKey || apiKey === 'YOUR_REMOVEBG_API_KEY') {
            await sock.sendMessage(chatId, {
                text: '❌ remove.bg API key set nahi hai. settings.js mein `removeBgApiKey` add karein.'
            }, { quoted: msg });
            return;
        }

        // Download the image
        const stream = await downloadContentFromMessage(targetImageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Send to remove.bg
        const form = new FormData();
        form.append('image_file', buffer, 'image.png');
        form.append('size', 'auto');

        const res = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
                'X-Api-Key': apiKey,
                ...form.getHeaders()
            },
            body: form
        });

        if (!res.ok) {
            if (res.status === 402) {
                await sock.sendMessage(chatId, {
                    text: '❌ Is mahine ka free quota (100 images) khatam ho chuka hai. Agle mahine reset hoga.'
                }, { quoted: msg });
                return;
            }
            const errBody = await res.text();
            throw new Error(`remove.bg API error ${res.status}: ${errBody}`);
        }

        const resultBuffer = await res.buffer();

        await sock.sendMessage(chatId, {
            image: resultBuffer,
            caption: '✅ Background removed!'
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in rmbg command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to remove background.\n\n_Debug: ${error.message || error}_`
        }, { quoted: msg });
    }
}

module.exports = rmbgCommand;
