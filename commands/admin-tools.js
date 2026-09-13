// commands/admin-tools.js - Broadcast, Stats, Backup, Block/Unblock
const fs = require('fs-extra');
const path = require('path');

async function broadcastCommand(sock, from, msg, isOwner, args) {
    if (!isOwner) return await sock.sendMessage(from, { text: "❌ Only the bot owner can use this command." }, { quoted: msg });
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: "❌ Usage: .broadcast <message>" }, { quoted: msg });

    try {
        const groups = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groups);
        let sent = 0;
        for (const gid of groupIds) {
            try {
                await sock.sendMessage(gid, { text: `📢 *BROADCAST*\n\n${text}` });
                sent++;
                await new Promise(r => setTimeout(r, 800));
            } catch (e) {}
        }
        await sock.sendMessage(from, { text: `✅ Broadcast sent to ${sent}/${groupIds.length} groups.` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Broadcast failed: " + e.message }, { quoted: msg });
    }
}

async function statsCommand(sock, from, msg, botData, startTime) {
    const uptimeMs = Date.now() - startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const mins = Math.floor((uptimeMs % 3600000) / 60000);
    let groupCount = 0;
    try {
        const groups = await sock.groupFetchAllParticipating();
        groupCount = Object.keys(groups).length;
    } catch (e) {}

    const text =
        `📊 *BOT STATISTICS*\n\n` +
        `⏱️ Uptime: ${hours}h ${mins}m\n` +
        `👥 Groups Connected: ${groupCount}\n` +
        `🤖 Total Registered Sessions: ${botData.registeredBots?.length || botData.totalBots || 0}\n` +
        `🔗 Antilink Groups: ${Object.keys(botData.antilinkGroups || {}).length}\n` +
        `🛡️ Antispam Groups: ${Object.keys(botData.antispamGroups || {}).length}`;

    await sock.sendMessage(from, { text }, { quoted: msg });
}

async function backupCommand(sock, from, msg, isOwner) {
    if (!isOwner) return await sock.sendMessage(from, { text: "❌ Only the bot owner can use this command." }, { quoted: msg });
    const dataFile = path.join(process.cwd(), 'data', 'bot_data.json');
    try {
        if (!fs.existsSync(dataFile)) return await sock.sendMessage(from, { text: "❌ No data file found yet." }, { quoted: msg });
        const buffer = await fs.readFile(dataFile);
        await sock.sendMessage(from, {
            document: buffer,
            fileName: `backup_${Date.now()}.json`,
            mimetype: 'application/json',
            caption: "✅ Bot data backup"
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Backup failed: " + e.message }, { quoted: msg });
    }
}

function getTarget(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    return mentioned || quoted || null;
}

async function blockCommand(sock, from, msg, isOwner, botData, saveBotData) {
    if (!isOwner) return await sock.sendMessage(from, { text: "❌ Only the bot owner can use this command." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user you want to block." }, { quoted: msg });
    try {
        await sock.updateBlockStatus(target, "block");
        if (!botData.blockedUsers) botData.blockedUsers = {};
        botData.blockedUsers[target] = true;
        saveBotData();
        await sock.sendMessage(from, { text: `🚫 Blocked @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to block: " + e.message }, { quoted: msg });
    }
}

async function unblockCommand(sock, from, msg, isOwner, botData, saveBotData) {
    if (!isOwner) return await sock.sendMessage(from, { text: "❌ Only the bot owner can use this command." }, { quoted: msg });
    const target = getTarget(msg);
    if (!target) return await sock.sendMessage(from, { text: "❌ Reply to or tag the user you want to unblock." }, { quoted: msg });
    try {
        await sock.updateBlockStatus(target, "unblock");
        if (botData.blockedUsers) delete botData.blockedUsers[target];
        saveBotData();
        await sock.sendMessage(from, { text: `✅ Unblocked @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to unblock: " + e.message }, { quoted: msg });
    }
}

module.exports = { broadcastCommand, statsCommand, backupCommand, blockCommand, unblockCommand };
