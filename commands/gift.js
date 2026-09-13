const settings = require('../settings');

function normalizeNumber(value) {
    const number = String(value || '').replace(/\D/g, '');
    return number.length >= 7 && number.length <= 15 ? number : '';
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Usage:
// .gift 923001234567,Hello ❤️,50
async function giftCommand(sock, from, msg, q) {
    const parts = String(q || '').split(',');

    const target = normalizeNumber(parts[0]);
    const text = (parts[1] || '').trim();
    const count = parseInt(parts[2], 10);

    if (!target || !text || !Number.isInteger(count) || count < 1 || count > 800) {
        return await sock.sendMessage(from, {
            text:
`🎁 *${settings.botName} - Gift Command*

Usage:
.gift 923001234567,Hello ❤️,10

Example:
.gift 923001234567,Hi Bro ❤️,25

📌 Maximum Count: 800`
        }, { quoted: msg });
    }

    const jid = `${target}@s.whatsapp.net`;

    await sock.sendMessage(from, {
        react: {
            text: '🎁',
            key: msg.key
        }
    });

    for (let i = 0; i < count; i++) {
        await sock.sendMessage(jid, {
            text
        });

        await wait(700);
    }

    await sock.sendMessage(from, {
        text:
`✅ Gift Sent Successfully

👤 Number: ${target}
📦 Count: ${count}
💬 Message: ${text}

🤖 ${settings.botName}`
    }, { quoted: msg });
}

module.exports = giftCommand;