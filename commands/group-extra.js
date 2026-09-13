// commands/group-extra.js
// Warn, Mute, Welcome/Goodbye, Promote/Demote, Group Settings, Antispam

function getTarget(msg, args) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    return mentioned || quoted || null;
}

// ---------- WARN ----------
async function warnCommand(sock, from, msg, isAdmin, botData, saveBotData) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user you want to warn." }, { quoted: msg });

    if (!botData.warnings) botData.warnings = {};
    if (!botData.warnings[from]) botData.warnings[from] = {};
    botData.warnings[from][target] = (botData.warnings[from][target] || 0) + 1;
    const count = botData.warnings[from][target];
    saveBotData();

    if (count >= 3) {
        try {
            await sock.sendMessage(from, { text: `⚠️ @${target.split('@')[0]} reached 3 warnings. Removing...`, mentions: [target] }, { quoted: msg });
            await sock.groupParticipantsUpdate(from, [target], "remove");
            botData.warnings[from][target] = 0;
            saveBotData();
        } catch (e) {
            await sock.sendMessage(from, { text: "❌ Reached 3 warnings but I couldn't remove (need admin)." }, { quoted: msg });
        }
    } else {
        await sock.sendMessage(from, { text: `⚠️ @${target.split('@')[0]} warned (${count}/3)`, mentions: [target] }, { quoted: msg });
    }
}

async function unwarnCommand(sock, from, msg, isAdmin, botData, saveBotData) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user." }, { quoted: msg });

    if (!botData.warnings || !botData.warnings[from] || !botData.warnings[from][target]) {
        return await sock.sendMessage(from, { text: "ℹ️ This user has no warnings." }, { quoted: msg });
    }
    botData.warnings[from][target] = Math.max(0, botData.warnings[from][target] - 1);
    saveBotData();
    await sock.sendMessage(from, { text: `✅ Warning removed. Now: ${botData.warnings[from][target]}/3`, mentions: [target] }, { quoted: msg });
}

// ---------- MUTE ----------
async function muteCommand(sock, from, msg, isAdmin, botData, saveBotData) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user you want to mute." }, { quoted: msg });

    if (!botData.mutedUsers) botData.mutedUsers = {};
    if (!botData.mutedUsers[from]) botData.mutedUsers[from] = {};
    botData.mutedUsers[from][target] = true;
    saveBotData();
    await sock.sendMessage(from, { text: `🔇 @${target.split('@')[0]} has been muted in this group.`, mentions: [target] }, { quoted: msg });
}

async function unmuteCommand(sock, from, msg, isAdmin, botData, saveBotData) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user you want to unmute." }, { quoted: msg });

    if (botData.mutedUsers?.[from]) {
        delete botData.mutedUsers[from][target];
        saveBotData();
    }
    await sock.sendMessage(from, { text: `🔊 @${target.split('@')[0]} has been unmuted.`, mentions: [target] }, { quoted: msg });
}

// Called from index.js main message loop to enforce mute
async function handleMuteCheck(sock, from, sender, msg, botData) {
    if (!from.endsWith('@g.us')) return false;
    if (botData.mutedUsers?.[from]?.[sender]) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
        return true;
    }
    return false;
}

// ---------- WELCOME / GOODBYE ----------
async function welcomeCommand(sock, from, msg, isAdmin, botData, saveBotData, args) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    if (!botData.welcomeGoodbye) botData.welcomeGoodbye = {};
    if (!botData.welcomeGoodbye[from]) botData.welcomeGoodbye[from] = {};

    const action = args[0]?.toLowerCase();
    if (action === 'on') {
        botData.welcomeGoodbye[from].welcome = true;
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Welcome messages enabled!" }, { quoted: msg });
    } else if (action === 'off') {
        botData.welcomeGoodbye[from].welcome = false;
        saveBotData();
        await sock.sendMessage(from, { text: "❌ Welcome messages disabled!" }, { quoted: msg });
    } else if (action === 'set') {
        const customMsg = args.slice(1).join(' ');
        if (!customMsg) return await sock.sendMessage(from, { text: "❌ Usage: .welcome set <message> (use {user} for mention)" }, { quoted: msg });
        botData.welcomeGoodbye[from].welcomeMsg = customMsg;
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Custom welcome message set!" }, { quoted: msg });
    } else {
        await sock.sendMessage(from, { text: "❌ Usage: .welcome [on/off/set <message>]" }, { quoted: msg });
    }
}

async function goodbyeCommand(sock, from, msg, isAdmin, botData, saveBotData, args) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    if (!botData.welcomeGoodbye) botData.welcomeGoodbye = {};
    if (!botData.welcomeGoodbye[from]) botData.welcomeGoodbye[from] = {};

    const action = args[0]?.toLowerCase();
    if (action === 'on') {
        botData.welcomeGoodbye[from].goodbye = true;
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Goodbye messages enabled!" }, { quoted: msg });
    } else if (action === 'off') {
        botData.welcomeGoodbye[from].goodbye = false;
        saveBotData();
        await sock.sendMessage(from, { text: "❌ Goodbye messages disabled!" }, { quoted: msg });
    } else if (action === 'set') {
        const customMsg = args.slice(1).join(' ');
        if (!customMsg) return await sock.sendMessage(from, { text: "❌ Usage: .goodbye set <message> (use {user} for mention)" }, { quoted: msg });
        botData.welcomeGoodbye[from].goodbyeMsg = customMsg;
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Custom goodbye message set!" }, { quoted: msg });
    } else {
        await sock.sendMessage(from, { text: "❌ Usage: .goodbye [on/off/set <message>]" }, { quoted: msg });
    }
}

// Called from group-participants.update listener in index.js
async function handleGroupParticipantsUpdate(sock, update, botData) {
    try {
        const { id: from, participants, action } = update;
        const cfg = botData.welcomeGoodbye?.[from];
        if (!cfg) return;
        for (const p of participants) {
            const jid = typeof p === 'string' ? p : (p?.id || p?.jid);
            if (!jid) continue;
            const tag = `@${jid.split('@')[0]}`;
            if (action === 'add' && cfg.welcome) {
                const template = cfg.welcomeMsg || `👋 Welcome {user} to the group!`;
                await sock.sendMessage(from, { text: template.replace('{user}', tag), mentions: [jid] });
            } else if (action === 'remove' && cfg.goodbye) {
                const template = cfg.goodbyeMsg || `👋 Goodbye {user}, take care!`;
                await sock.sendMessage(from, { text: template.replace('{user}', tag), mentions: [jid] });
            }
        }
    } catch (e) {
        console.error('Welcome/Goodbye Error:', e);
    }
}

// ---------- PROMOTE / DEMOTE ----------
async function promoteCommand(sock, from, msg, isAdmin) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user you want to promote." }, { quoted: msg });
    try {
        await sock.groupParticipantsUpdate(from, [target], "promote");
        await sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} is now an admin.`, mentions: [target] }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to promote. Make sure I am an admin." }, { quoted: msg });
    }
}

async function demoteCommand(sock, from, msg, isAdmin) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user you want to demote." }, { quoted: msg });
    try {
        await sock.groupParticipantsUpdate(from, [target], "demote");
        await sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} is no longer an admin.`, mentions: [target] }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to demote. Make sure I am an admin." }, { quoted: msg });
    }
}

// ---------- GROUP SETTINGS ----------
async function groupsettingsCommand(sock, from, msg, isAdmin, botData) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    const on = (v) => v ? '✅' : '❌';
    const text =
        `⚙️ *Group Settings*\n\n` +
        `🔗 Antilink: ${botData.antilinkGroups?.[from] ? on(true) + ' (' + botData.antilinkGroups[from] + ')' : on(false)}\n` +
        `🛡️ Antispam: ${on(botData.antispamGroups?.[from])}\n` +
        `📛 Antistatus: ${on(botData.antiStatusGroups?.[from])}\n` +
        `👋 Welcome: ${on(botData.welcomeGoodbye?.[from]?.welcome)}\n` +
        `🚪 Goodbye: ${on(botData.welcomeGoodbye?.[from]?.goodbye)}\n` +
        `🚫 Kick-Offline: ${on(botData.kickOffline?.[from])}`;
    await sock.sendMessage(from, { text }, { quoted: msg });
}

// ---------- ANTISPAM ----------
const spamTracker = {};

async function antispamCommand(sock, from, msg, isAdmin, botData, saveBotData, args) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    if (!botData.antispamGroups) botData.antispamGroups = {};
    const action = args[0]?.toLowerCase();
    if (action === 'on') {
        botData.antispamGroups[from] = true;
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Antispam Enabled! (max 6 messages / 10 sec)" }, { quoted: msg });
    } else if (action === 'off') {
        botData.antispamGroups[from] = false;
        saveBotData();
        await sock.sendMessage(from, { text: "❌ Antispam Disabled!" }, { quoted: msg });
    } else {
        await sock.sendMessage(from, { text: "❌ Usage: .antispam [on/off]" }, { quoted: msg });
    }
}

// Called from index.js main message loop
async function handleAntispam(sock, from, sender, msg, botData, isAdmin) {
    if (!from.endsWith('@g.us') || isAdmin || !botData.antispamGroups?.[from]) return false;
    const key = from + '_' + sender;
    const now = Date.now();
    if (!spamTracker[key]) spamTracker[key] = [];
    spamTracker[key] = spamTracker[key].filter(t => now - t < 10000);
    spamTracker[key].push(now);

    if (spamTracker[key].length > 6) {
        try {
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]} please slow down (spam detected).`, mentions: [sender] });
        } catch (e) {}
        return true;
    }
    return false;
}

module.exports = {
    warnCommand, unwarnCommand,
    muteCommand, unmuteCommand, handleMuteCheck,
    welcomeCommand, goodbyeCommand, handleGroupParticipantsUpdate,
    promoteCommand, demoteCommand,
    groupsettingsCommand,
    antispamCommand, handleAntispam
};
