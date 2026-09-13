const { universalDownload } = require('../lib/universalDownload');

async function instaCommand(sock, from, msg, q) {
    if (!q) return await sock.sendMessage(from, { text: "❌ Please provide an Instagram URL." }, { quoted: msg });

    try {
        const loadEmojis = ['📥', '⏳', '📸'];
        for (const emoji of loadEmojis) {
            await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        }

        const data = await universalDownload(q);
        const videos = data.medias.filter(m => m.type === 'video');
        const images = data.medias.filter(m => m.type !== 'video');

        if (videos.length) {
            await sock.sendMessage(from, { video: { url: videos[0].url }, caption: "✅ Instagram Video" }, { quoted: msg });
        } else if (images.length) {
            for (const img of images.slice(0, 10)) {
                await sock.sendMessage(from, { image: { url: img.url }, caption: "✅ Instagram Image" }, { quoted: msg });
            }
        } else {
            throw new Error("No media found");
        }
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error downloading Instagram content: " + e.message }, { quoted: msg });
    }
}

module.exports = instaCommand;
