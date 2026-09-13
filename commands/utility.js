// commands/utility.js - Reminder, Todo, Calculator, Define, Fact
const axios = require('axios');

// ---------- CALCULATOR ----------
async function calcCommand(sock, from, msg, args) {
    const expr = args.join(' ');
    if (!expr) return await sock.sendMessage(from, { text: "❌ Usage: .calc <expression>\nExample: .calc (5+3)*2" }, { quoted: msg });
    if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
        return await sock.sendMessage(from, { text: "❌ Only numbers and + - * / ( ) % are allowed." }, { quoted: msg });
    }
    try {
        const result = Function(`"use strict"; return (${expr})`)();
        await sock.sendMessage(from, { text: `🧮 *CALCULATOR*\n\n${expr} = *${result}*` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Invalid expression." }, { quoted: msg });
    }
}

// ---------- DEFINE ----------
async function defineCommand(sock, from, msg, args) {
    const word = args.join(' ');
    if (!word) return await sock.sendMessage(from, { text: "❌ Usage: .define <word>" }, { quoted: msg });
    try {
        const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 8000 });
        const entry = res.data[0];
        const meaning = entry.meanings[0];
        const def = meaning.definitions[0];
        let text = `📖 *${entry.word.toUpperCase()}* (${meaning.partOfSpeech})\n\n${def.definition}`;
        if (def.example) text += `\n\n_Example: ${def.example}_`;
        await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: `❌ No definition found for "${word}".` }, { quoted: msg });
    }
}

// ---------- FACT ----------
async function factCommand(sock, from, msg) {
    try {
        const res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', { timeout: 8000 });
        await sock.sendMessage(from, { text: `🧠 *RANDOM FACT*\n\n${res.data.text}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Couldn't fetch a fact right now, try again." }, { quoted: msg });
    }
}

// ---------- TODO ----------
async function todoCommand(sock, from, msg, botData, saveBotData, userId, args) {
    if (!botData.todos) botData.todos = {};
    if (!botData.todos[userId]) botData.todos[userId] = [];
    const list = botData.todos[userId];

    const action = args[0]?.toLowerCase();
    if (action === 'add') {
        const item = args.slice(1).join(' ');
        if (!item) return await sock.sendMessage(from, { text: "❌ Usage: .todo add <task>" }, { quoted: msg });
        list.push({ text: item, done: false });
        saveBotData();
        await sock.sendMessage(from, { text: `✅ Added to your to-do list: "${item}"` }, { quoted: msg });
    } else if (action === 'done') {
        const idx = parseInt(args[1]) - 1;
        if (isNaN(idx) || !list[idx]) return await sock.sendMessage(from, { text: "❌ Usage: .todo done <number>" }, { quoted: msg });
        list[idx].done = true;
        saveBotData();
        await sock.sendMessage(from, { text: `✅ Marked as done: "${list[idx].text}"` }, { quoted: msg });
    } else if (action === 'clear') {
        botData.todos[userId] = [];
        saveBotData();
        await sock.sendMessage(from, { text: "🗑️ To-do list cleared." }, { quoted: msg });
    } else {
        if (!list.length) return await sock.sendMessage(from, { text: "📋 Your to-do list is empty.\n\nUsage: .todo add <task>" }, { quoted: msg });
        const text = list.map((t, i) => `${i + 1}. ${t.done ? '✅' : '⬜'} ${t.text}`).join('\n');
        await sock.sendMessage(from, { text: `📋 *YOUR TO-DO LIST*\n\n${text}` }, { quoted: msg });
    }
}

// ---------- REMINDER ----------
function parseDuration(str) {
    const match = String(str).match(/^(\d+)(s|m|h)$/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return num * 1000;
    if (unit === 'm') return num * 60 * 1000;
    if (unit === 'h') return num * 60 * 60 * 1000;
    return null;
}

async function reminderCommand(sock, from, msg, botData, saveBotData, userId, args) {
    if (!botData.reminders) botData.reminders = [];
    const durationStr = args[0];
    const text = args.slice(1).join(' ');
    const ms = parseDuration(durationStr);
    if (!ms || !text) return await sock.sendMessage(from, { text: "❌ Usage: .reminder <10s/5m/2h> <message>" }, { quoted: msg });

    botData.reminders.push({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        chatId: from,
        userId,
        fireAt: Date.now() + ms,
        text,
        fired: false
    });
    saveBotData();
    await sock.sendMessage(from, { text: `⏰ Reminder set! I'll remind you in ${durationStr}: "${text}"` }, { quoted: msg });
}

// Called via setInterval from index.js — needs a map of userId -> BotSession to send via correct sock
async function checkReminders(sessions, botData, saveBotData) {
    if (!botData.reminders || !botData.reminders.length) return;
    const now = Date.now();
    let changed = false;
    for (const r of botData.reminders) {
        if (!r.fired && r.fireAt <= now) {
            r.fired = true;
            changed = true;
            const session = sessions[r.userId];
            if (session && session.sock && session.isConnected) {
                try {
                    await session.sock.sendMessage(r.chatId, { text: `⏰ *REMINDER*\n\n${r.text}` });
                } catch (e) {}
            }
        }
    }
    // Clean up fired reminders older than 1 day
    botData.reminders = botData.reminders.filter(r => !r.fired || (now - r.fireAt) < 86400000);
    if (changed) saveBotData();
}

module.exports = { calcCommand, defineCommand, factCommand, todoCommand, reminderCommand, checkReminders };
