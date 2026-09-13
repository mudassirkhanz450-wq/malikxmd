const fetch = require('node-fetch');
const settings = require('../settings');

async function wallpaperCommand(sock, chatId, msg) {
    // Extract text ourselves since dispatcher only passes (sock, from, msg)
    const fullText = msg.message?.conversation?.trim() ||
                     msg.message?.extendedTextMessage?.text?.trim() || '';
    const query = fullText.split(' ').slice(1).join(' ').trim();

    try {
        // Wallhaven public search API — no API key required
        const url = query
            ? `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(query)}&sorting=random&purity=100&categories=111`
            : `https://wallhaven.cc/api/v1/search?sorting=random&purity=100&categories=111`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Wallhaven API returned status ${response.status}`);
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            await sock.sendMessage(chatId, {
                text: query
                    ? `❌ "${query}" ke liye koi wallpaper nahi mila. Kuch aur keyword try karein.`
                    : '❌ Wallpaper nahi mil saka, dobara try karein.'
            }, { quoted: msg });
            return;
        }

        // Pick a random result from the page of results
        const pick = data.data[Math.floor(Math.random() * data.data.length)];
        const imageUrl = pick.path;

        await sock.sendMessage(chatId, {
            image: { url: imageUrl },
            caption: "✅ WALLPAPER DOWNLOADED BY " + settings.botName + ""
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in wallpaper command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to fetch wallpaper.\n\n_Debug: ${error.message || error}_`
        }, { quoted: msg });
    }
}

module.exports = wallpaperCommand;