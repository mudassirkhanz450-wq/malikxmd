const fetch = require('node-fetch');
const { getEmail } = require('./tempMailStore');

async function checkmailCommand(sock, chatId, msg) {
    try {
        // Allow optionally checking a specific address: .tmpib someone@catchmail.io
        const fullText = msg.message?.conversation?.trim() ||
                         msg.message?.extendedTextMessage?.text?.trim() || '';
        const manualEmail = fullText.split(' ').slice(1).join(' ').trim();

        const email = manualEmail || getEmail(chatId);

        if (!email) {
            await sock.sendMessage(chatId, {
                text: `❌ Koi temp mail nahi mila.\n\nPehle *.tmp* se generate karein, ya specific address check karein: *.tmpib <email>*`
            }, { quoted: msg });
            return;
        }

        const res = await fetch(`https://api.catchmail.io/api/v1/mailbox?address=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error(`catchmail API returned status ${res.status}`);

        const data = await res.json();
        const messages = data.messages || [];

        if (messages.length === 0) {
            await sock.sendMessage(chatId, {
                text: `📭 *Inbox Empty*\n\n📧 ${email}\n\nAbhi tak koi message nahi aaya.`
            }, { quoted: msg });
            return;
        }

        let inboxText = `📬 *Inbox: ${email}*\n\n`;
        messages.forEach((m, i) => {
            inboxText += `${i + 1}. *${m.subject || '(no subject)'}*\n   From: ${m.from}\n   ID: ${m.id}\n   Date: ${m.date}\n\n`;
        });
        inboxText += `_Full message padhne ke liye: *.tmprd <id>*_`;

        await sock.sendMessage(chatId, { text: inboxText }, { quoted: msg });
    } catch (error) {
        console.error('Error in checkmail command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to fetch inbox.\n\n_Debug: ${error.message || error}_`
        }, { quoted: msg });
    }
}

module.exports = checkmailCommand;