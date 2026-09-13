// commands/social.js - Confess, Poll, Couple, Rank

async function confessCommand(sock, from, msg, args) {
    if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ This command only works in groups." }, { quoted: msg });
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: "❌ Usage: .confess <your message>" }, { quoted: msg });
    try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
    await sock.sendMessage(from, { text: `🎭 *ANONYMOUS CONFESSION*\n\n${text}` });
}

async function pollCommand(sock, from, msg, args) {
    const raw = args.join(' ');
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) {
        return await sock.sendMessage(from, { text: "❌ Usage: .poll <question> | <option1> | <option2> | ...\nExample: .poll Best food? | Biryani | Pizza | Karahi" }, { quoted: msg });
    }
    const question = parts[0];
    const options = parts.slice(1);
    try {
        await sock.sendMessage(from, {
            poll: { name: question, values: options, selectableCount: 1 }
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to create poll: " + e.message }, { quoted: msg });
    }
}

async function coupleCommand(sock, from, msg) {
    if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ This command only works in groups." }, { quoted: msg });
    try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants.filter(p => !p.admin || true).map(p => p.id);
        if (participants.length < 2) return await sock.sendMessage(from, { text: "❌ Not enough members in group." }, { quoted: msg });
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        const [a, b] = shuffled;
        await sock.sendMessage(from, {
            text: `💕 *COUPLE OF THE DAY*\n\n@${a.split('@')[0]} ❤️ @${b.split('@')[0]}\n\nCongratulations! 🎉`,
            mentions: [a, b]
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to pick a couple." }, { quoted: msg });
    }
}

// Called from main message loop on every group text message (not just commands)
function trackRank(botData, from, sender) {
    if (!from.endsWith('@g.us')) return;
    if (!botData.rankTracker) botData.rankTracker = {};
    if (!botData.rankTracker[from]) botData.rankTracker[from] = {};
    botData.rankTracker[from][sender] = (botData.rankTracker[from][sender] || 0) + 1;
}

async function rankCommand(sock, from, msg, botData) {
    if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ This command only works in groups." }, { quoted: msg });
    const data = botData.rankTracker?.[from];
    if (!data || !Object.keys(data).length) return await sock.sendMessage(from, { text: "📊 No activity tracked yet." }, { quoted: msg });

    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const mentions = sorted.map(([id]) => id);
    const text = "🏆 *MOST ACTIVE MEMBERS*\n\n" + sorted.map(([id, count], i) => `${i + 1}. @${id.split('@')[0]} — ${count} messages`).join('\n');
    await sock.sendMessage(from, { text, mentions }, { quoted: msg });
}

module.exports = { confessCommand, pollCommand, coupleCommand, rankCommand, trackRank };
