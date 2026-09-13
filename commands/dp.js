const axios = require('axios');

async function dpCommand(sock, from, msg) {
    try {
        let target;

        // 1. Get target from mention
        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // 2. Get target from reply
        else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        }
        // 3. Default target
        else {
            // In group: target is sender (the one who sent the command)
            // In DM: target is the other person
            target = from.endsWith('@g.us') ? (msg.key.participant || msg.participant) : from;
        }

        // Final fallback to sender
        if (!target) target = msg.key.participant || msg.participant || from;

        // Reaction for feedback
        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

        console.log('[DP] resolved target JID:', target);

        let ppUrl;

        // Try high-res
        try {
            ppUrl = await sock.profilePictureUrl(target, 'image');
            console.log('[DP] got high-res url:', ppUrl);
        } catch (e) {
            console.log('[DP] high-res fetch failed:', e.message);
            ppUrl = undefined;
        }

        // If high-res missing/undefined, try preview
        if (!ppUrl) {
            try {
                ppUrl = await sock.profilePictureUrl(target, 'preview');
                console.log('[DP] got preview url:', ppUrl);
            } catch (e2) {
                console.log('[DP] preview fetch failed too:', e2.message);
                ppUrl = undefined;
            }
        }

        // If still nothing, use fallback default icon
        if (!ppUrl) {
            console.log('[DP] no valid DP found, using fallback image');
            ppUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
        }

        // Download image manually into a Buffer instead of letting baileys
        // fetch the URL itself. This avoids the getStream() crash caused by
        // WhatsApp's CDN sometimes rejecting/redirecting requests without
        // proper headers.
        let imageBuffer;
        try {
            const res = await axios.get(ppUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
                },
                timeout: 15000,
                validateStatus: (s) => s === 200
            });
            imageBuffer = Buffer.from(res.data);
        } catch (dlErr) {
            console.error('DP download failed, using fallback image:', dlErr.message);
            const res = await axios.get(
                'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                { responseType: 'arraybuffer' }
            );
            imageBuffer = Buffer.from(res.data);
        }

        await sock.sendMessage(
            from,
            {
                image: imageBuffer,
                caption: `✅ *Profile Picture*\n👤 *User:* @${target.split('@')[0]}`,
                mentions: [target]
            },
            { quoted: msg }
        );
    } catch (e) {
        console.error('DP Command Error:', e);
        await sock.sendMessage(from, { text: '❌ Error: Could not process DP command.' }, { quoted: msg });
    }
}

module.exports = dpCommand;