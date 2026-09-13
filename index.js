require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadContentFromMessage, jidNormalizedUser, Browsers, delay } = require('@whiskeysockets/baileys');
const P = require('pino');
const { OpenAI } = require('openai');

// Import Commands
const commands = {
    song: require('./commands/song'),
    weather: require('./commands/weather'),
    video: require('./commands/video'),
    kick: require('./commands/kick'),
    wallpaper: require('./commands/wallpaper'),
    private: require('./commands/private'),
    public: require('./commands/public'),
    owner: require('./commands/owner'),
    ai: require('./commands/ai'),
    antilink: require('./commands/antilink'),
    anticall: require('./commands/anticall'),
    status: require('./commands/status'),
    antidelete: require('./commands/antidelete'),
    ping: require('./commands/ping'),
    autoreacts: require('./commands/autoreacts'),
    hidetag: require('./commands/hidetag'),
    tagall: require('./commands/tagall'),
    setname: require('./commands/setname'),
    insta: require('./commands/insta'),
    tiktok: require('./commands/tiktok'),
    dp: require('./commands/dp'),
    tmp: require('./commands/tempmailCommand'),
    tmpib: require('./commands/checkmailCommand'),
    tmprst: require('./commands/resetmailCommand'),
    vv: require('./commands/vv'),
    joke: require('./commands/joke'),
    meme: require('./commands/meme'),
    groupinfo: require('./commands/groupinfo'),
    gdrive: require('./commands/gdrive'),
    rmbg: require('./commands/rmbgCommand'),
    mf: require('./commands/mf'),
    translate: require('./commands/translate').handleTranslateCommand,
    autostatus: require('./commands/status'),

    // New Commands
    apk: require('./commands/apk'),
    autoread: require('./commands/autoread').autoreadCommand,
    character: require('./commands/character'),
    emojimix: require('./commands/emojimix'),
    facebook: require('./commands/facebook'),
    hack: require('./commands/hack'),
    accept: require('./commands/accept'),
    kickoffline: require('./commands/kickoffline'),
    antistatus: require('./commands/antistatus'),
    get: require('./commands/get'),
    gift: require('./commands/gift'),
    channelid: require('./commands/channelid')
};

// ===== NEW UPGRADE: Extra Command Modules (free, no paid API needed) =====
const groupExtra = require('./commands/group-extra');
const funCmds = require('./commands/fun');
const adminTools = require('./commands/admin-tools');
const textAi = require('./commands/text-ai');
const islamicCmds = require('./commands/islamic');
const utilityCmds = require('./commands/utility');
const socialCmds = require('./commands/social');
const mediaLocal = require('./commands/media-local');
const vcCommand = require('./commands/voicechanger');
const BOT_START_TIME = Date.now();

const { handleAutoread } = require('./commands/autoread');
const { handleStatusUpdate } = require('./commands/autostatus');
const { storeMessage, handleMessageRevocation } = require('./commands/antidelete');
const settings = require('./settings');

const app = express();
const server = http.createServer(app);

// Telegram Bot Setup
const tgToken = process.env.TELEGRAM_BOT_TOKEN || "8848738676:AAF8ZtCaUdRknrAf15SdSzaFNM9rN4F9QL4";
const tgBot = new TelegramBot(tgToken, { polling: true });

// ═══════════════════════════════════════
// Shared premium Telegram box (wrapped in a code block so it always
// renders perfectly aligned, regardless of device/font)
// ═══════════════════════════════════════
function tgBox(title, lines) {
    return "```\n" +
        "┌────────────────────────────┐\n" +
        "   " + title + "\n" +
        "└────────────────────────────┘\n\n" +
        lines.join("\n") +
        "\n```";
}

// ═══════════════════════════════════════
// FIX: Telegram → WhatsApp session handling
//
// Previously the session `userId` was derived from the Telegram
// `chatId`, which meant every number sent from the same Telegram
// chat reused the SAME auth folder. That caused:
//   1) pairing codes not being generated for a 2nd/3rd number
//      (creds.registered was already true from the 1st number)
//   2) an endless "connection closed... reconnecting" loop
//      (stale/mismatched creds for the wrong number)
//
// Fix: session key = WhatsApp phone number (unique per bot),
// and we keep a chatId -> [numbers] map so one Telegram user can
// track / list / logout multiple connected WhatsApp numbers.
// ═══════════════════════════════════════

tgBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '/start') {
        const caption = tgBox(settings.botName, [
            "  Welcome! Get your personal",
            "  WhatsApp bot up and running",
            "  in seconds.",
            "",
            "  Step    : Send your number",
            "  Format  : 923000000000",
            "",
            "  You can send multiple numbers",
            "  to run multiple bots.",
            "",
            "  /list        - your connected bots",
            "  /logout <no> - disconnect a bot",
            "",
            "  Owner   : " + settings.ownerName
        ]);

        try {
            await tgBot.sendPhoto(chatId, settings.telegramImage, {
                caption,
                parse_mode: 'Markdown'
            });
        } catch (e) {
            // Fallback to text-only if the image URL fails to load
            await tgBot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
        }
        return;
    }

    if (text === '/list') {
        const numbers = botData.tgUserNumbers[chatId] || [];
        if (numbers.length === 0) {
            await tgBot.sendMessage(chatId,
                tgBox("YOUR BOTS", [
                    "  Koi WhatsApp number connected",
                    "  nahi hai abhi.",
                    "",
                    "  Number bhejein pairing shuru",
                    "  karne ke liye."
                ]),
                { parse_mode: 'Markdown' }
            );
        } else {
            const lines = numbers.map(n =>
                "  " + n + " : " + (sessions[n]?.isConnected ? "🟢 Connected" : "🔴 Offline")
            );
            await tgBot.sendMessage(chatId, tgBox("YOUR BOTS", lines), { parse_mode: 'Markdown' });
        }
        return;
    }

    if (text && text.startsWith('/logout')) {
        const number = text.split(' ')[1];
        const userNumbers = botData.tgUserNumbers[chatId] || [];

        if (!number) {
            await tgBot.sendMessage(chatId,
                tgBox("LOGOUT", ["  Format : /logout 923000000000"]),
                { parse_mode: 'Markdown' }
            );
            return;
        }

        if (!userNumbers.includes(number)) {
            await tgBot.sendMessage(chatId,
                tgBox("LOGOUT", ["  Ye number aapke account se", "  connected nahi hai."]),
                { parse_mode: 'Markdown' }
            );
            return;
        }

        await logoutSession(number);
        botData.tgUserNumbers[chatId] = userNumbers.filter(n => n !== number);
        saveBotData();

        await tgBot.sendMessage(chatId,
            tgBox("LOGGED OUT", ["  Number : " + number, "  Status : Disconnected"]),
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (/^\d+$/.test(text)) {
        const userId = text; // session key = phone number (NOT chatId)

        if (!botData.tgUserNumbers[chatId]) botData.tgUserNumbers[chatId] = [];
        if (!botData.tgUserNumbers[chatId].includes(userId)) {
            botData.tgUserNumbers[chatId].push(userId);
        }

        if (!sessions[userId]) {
            sessions[userId] = new BotSession(userId);
        }

        if (!botData.statusSettings[userId]) {
            botData.statusSettings[userId] = {
                autoStatus: false,
                autoSeen: false,
                autoLike: false,
                autoDownload: false,
                isPublic: false
            };
        }
        saveBotData();

        await tgBot.sendMessage(chatId,
            tgBox("GENERATING CODE", [
                "  Number  : " + text,
                "  Status  : Processing...",
                "",
                "  Pairing code is on its way,",
                "  please wait a moment."
            ]),
            { parse_mode: 'Markdown' }
        );
        sessions[userId].tgChatId = chatId;
        await sessions[userId].initialize(text);
    }
});

const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

let openai = null;
if (process.env.OPENAI_API_KEY) {
    try {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1"
        });
    } catch (e) {}
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const AUTH_DIR = './auth_info';
const DATA_FILE = './data/bot_data.json';
fs.ensureDirSync(AUTH_DIR);
fs.ensureDirSync('./data');

let botData = {
    antilinkGroups: {},
    totalBots: 0,
    registeredBots: [],
    statusSettings: {},
    antiDelete: {},
    userNames: {},
    antiCall: {},
    tgUserNumbers: {} // { "<telegram chatId>": ["923xxxxxxxxx", "923yyyyyyyyy"] }
};
if (fs.existsSync(DATA_FILE)) {
    try { botData = fs.readJsonSync(DATA_FILE); } catch (e) {}
}
if (!botData.tgUserNumbers) botData.tgUserNumbers = {};

function saveBotData() {
    fs.writeJsonSync(DATA_FILE, botData);
}

const sessions = {};
const userSockets = {};
const messageLogs = {};

// ═══════════════════════════════════════
// Shared logout logic, reused by both the Telegram /logout command
// and the website's socket 'logout' event.
// ═══════════════════════════════════════
async function logoutSession(userId) {
    if (sessions[userId]) {
        if (sessions[userId].sock) {
            try {
                const botNumber = jidNormalizedUser(sessions[userId].sock.user.id);
                await sessions[userId].sock.sendMessage(botNumber, {
                    text: "◤━━━━━━━━━━━━━━━◥\n" +
                          "   🔴 𝗕𝗢𝗧 𝗟𝗢𝗚𝗚𝗘𝗗 𝗢𝗨𝗧\n" +
                          "◣━━━━━━━━━━━━━━━◢\n\n" +
                          " ▸ Status : 👋 Goodbye!\n\n" +
                          " ➤ Pair again to reconnect 🔄\n\n" +
                          " ⟦ 👑 " + settings.botName + " ⟧"
                });
                await sessions[userId].sock.logout();
            } catch (e) {}
        }
        const authPath = path.join(AUTH_DIR, userId);
        if (fs.existsSync(authPath)) fs.removeSync(authPath);
        delete sessions[userId];
        io.emit('total-active', Object.values(sessions).filter(s => s.isConnected).length);
        const socketId = userSockets[userId];
        if (socketId) io.to(socketId).emit('connection-status', { connected: false, user: userId });
    }
}

// ===== NEW UPGRADE: Reminder checker (runs every 30s) =====
setInterval(() => {
    utilityCmds.checkReminders(sessions, botData, saveBotData).catch(() => {});
}, 30 * 1000);

// Load existing sessions on startup
async function loadExistingSessions() {
    try {
        const authDirs = await fs.readdir(AUTH_DIR);
        for (const userId of authDirs) {
            const authPath = path.join(AUTH_DIR, userId);
            const stats = await fs.stat(authPath);
            if (stats.isDirectory()) {
                const credsFile = path.join(authPath, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    console.log('📂 [System] Found existing session for: ' + userId + '. Initializing...');
                    if (!sessions[userId]) {
                        sessions[userId] = new BotSession(userId);
                        sessions[userId].initialize().catch(err => {
                            console.error('❌ [System] Failed to auto-initialize session ' + userId + ': ' + err.message);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('❌ [System] Error loading existing sessions:', err.message);
    }
}

const toBold = (text) => {
    const boldChars = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    return text.split('').map(c => boldChars[c] || c).join('');
};

// ═══════════════════════════════════════
// STYLISH TEXT TEMPLATES
// ═══════════════════════════════════════

const STYLISH = {
    connected:
        `╭━━━〔 ${toBold("⚡ " + settings.botName + " ⚡")} 〕━━━┈⊷\n` +
        `┃ 🟢 ${toBold("𝗦𝘁𝗮𝘁𝘂𝘀:")} 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱\n` +
        `┃ ⚙️ ${toBold("𝗦𝘆𝘀𝘁𝗲𝗺:")} 𝗔𝗰𝘁𝗶𝘃𝗲\n` +
        `┃ 🌐 ${toBold("𝗦𝗲𝗿𝘃𝗲𝗿:")} 𝗥𝘂𝗻𝗻𝗶𝗻𝗴\n` +
        `┃ 🔥 ${toBold("𝗠𝗼𝗱𝘂𝗹𝗲𝘀:")} 𝗔𝗰𝘁𝗶𝘃𝗲\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
        ` ➤ ${toBold(".𝗺𝗲𝗻𝘂")} type karein commands ke liye\n\n` +
        `╭━━━〔 ${toBold("👑 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬")} 〕━━━┈⊷\n` +
        `┃ 🚀 ${toBold(settings.ownerName)}\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷`,

    disconnected:
        `╭━━━〔 ${toBold("⚠️ " + settings.botName + " ⚠️")} 〕━━━┈⊷\n` +
        `┃ 🔴 ${toBold("𝗦𝘁𝗮𝘁𝘂𝘀:")} 𝗗𝗶𝘀𝗰𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱\n` +
        `┃ 🔄 ${toBold("𝗦𝘆𝘀𝘁𝗲𝗺:")} 𝗥𝗲𝗰𝗼𝗻𝗻𝗲𝗰𝘁𝗶𝗻𝗴...\n` +
        `┃ 🌐 ${toBold("𝗦𝗲𝗿𝘃𝗲𝗿:")} 𝗔𝗰𝘁𝗶𝘃𝗲\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
        ` ➤ Please wait, reconnecting...\n\n` +
        `╭━━━〔 ${toBold("👑 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬")} 〕━━━┈⊷\n` +
        `┃ 🚀 ${toBold(settings.ownerName)}\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷`,

    keepAlive:
        `╭━━━〔 ${toBold("⚡ " + settings.botName + " ⚡")} 〕━━━┈⊷\n` +
        `┃ 🟢 ${toBold("𝗦𝘁𝗮𝘁𝘂𝘀:")} 𝗔𝗰𝘁𝗶𝘃𝗲 𝟮𝟰/𝟳\n` +
        `┃ ⏱️ ${toBold("𝗨𝗽𝘁𝗶𝗺𝗲:")} 𝗔𝗰𝘁𝗶𝘃𝗲\n` +
        `┃ 🛡️ ${toBold("𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆:")} 𝗘𝗻𝗮𝗯𝗹𝗲𝗱\n` +
        `┃ 🚀 ${toBold("𝗣𝗲𝗿𝗳𝗼𝗿𝗺𝗮𝗻𝗰𝗲:")} 𝗢𝗽𝘁𝗶𝗺𝗮𝗹\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
        ` ➤ Your bot is running smoothly!\n\n` +
        `╭━━━〔 ${toBold("👑 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬")} 〕━━━┈⊷\n` +
        `┃ 🚀 ${toBold(settings.ownerName)}\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷`,

    pairingCode:
        `╭━━━〔 ${toBold("🔑 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗖𝗢𝗗𝗘")} 〕━━━┈⊷\n` +
        `┃ 🔑 ${toBold("𝗖𝗼𝗱𝗲:")} [CODE]\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
        ` ➤ Enter this code in your WhatsApp\n` +
        ` ➤ Expires in 60 seconds ⏰\n\n` +
        `╭━━━〔 ${toBold("👑 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬")} 〕━━━┈⊷\n` +
        `┃ 🚀 ${toBold(settings.botName)}\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷`,

    antiCall:
        `╭━━━〔 ${toBold("🚫 𝗔𝗡𝗧𝗜-𝗖𝗔𝗟𝗟")} 〕━━━┈⊷\n` +
        `┃ 🚫 ${toBold("𝗖𝗮𝗹𝗹𝘀:")} 𝗡𝗼𝘁 𝗔𝗰𝗰𝗲𝗽𝘁𝗲𝗱\n` +
        `┃ 📵 ${toBold("𝗔𝗰𝘁𝗶𝗼𝗻:")} 𝗔𝘂𝘁𝗼-𝗥𝗲𝗷𝗲𝗰𝘁𝗲𝗱\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
        ` ➤ Please send a message instead 💬\n\n` +
        `╭━━━〔 ${toBold("👑 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬")} 〕━━━┈⊷\n` +
        `┃ 🚀 ${toBold(settings.ownerName)}\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷`,

    sessionExpired:
        `╭━━━〔 ${toBold("🔴 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗘𝗫𝗣𝗜𝗥𝗘𝗗")} 〕━━━┈⊷\n` +
        `┃ 🔴 ${toBold("𝗦𝘁𝗮𝘁𝘂𝘀:")} 𝗘𝘅𝗽𝗶𝗿𝗲𝗱\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
        ` ➤ Please pair again with a new code\n` +
        ` ➤ Enter your number to reconnect 📱\n\n` +
        `╭━━━〔 ${toBold("👑 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬")} 〕━━━┈⊷\n` +
        `┃ 🚀 ${toBold(settings.botName)}\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷`
};

class BotSession {
    constructor(userId) {
        this.userId = userId;
        this.sock = null;
        this.isConnected = false;
        this.aiEnabled = false;
        this.autoReact = botData.statusSettings[userId]?.autoReact || false;
        this.isPublic = botData.statusSettings[userId]?.isPublic || false;
        this.authPath = path.join(AUTH_DIR, userId);
        this.processedMessages = new Set();
        this.activeInterval = null;
        this.isInitializing = false;
        this.userChats = {};
        this.lastConnectMessageTime = null;
    }

    sendLog(message, type = 'info') {
        const logEntry = { timestamp: new Date().toLocaleTimeString(), message, type };
        const socketId = userSockets[this.userId];
        if (socketId) io.to(socketId).emit('console', logEntry);
        console.log('[' + this.userId + '] ' + message);
    }

    sendConnectionStatus() {
        const socketId = userSockets[this.userId];
        if (socketId) {
            io.to(socketId).emit('connection-status', {
                connected: this.isConnected,
                user: this.userId
            });
        }
        io.emit('total-active', Object.values(sessions).filter(s => s.isConnected).length);
    }

    async getAIResponse(userJid, userMessage) {
        if (!openai) return "❌ AI is not configured.";
        try {
            const completion = await openai.chat.completions.create({
                model: process.env.AI_MODEL || "gpt-3.5-turbo",
                messages: [{ role: "system", content: "Helpful assistant." }, { role: "user", content: userMessage }],
                max_tokens: 150
            });
            return completion.choices[0].message.content.trim();
        } catch (error) {
            return "❌ AI Error: " + error.message;
        }
    }

    startActiveCheck() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeInterval = setInterval(async () => {
            if (this.isConnected && this.sock?.user) {
                try {
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    await this.sock.sendMessage(botNumber, { text: STYLISH.keepAlive });
                    this.sendLog("✅ Keep-alive: Status message sent successfully", "success");
                } catch (e) {
                    this.sendLog("⚠️ Keep-alive failed: " + e.message, "error");
                }
            }
        }, 60 * 60 * 1000); // Once per hour
    }

    async initialize(pairingNumber = null) {
        if (this.isInitializing) {
            this.sendLog("⏳ Initialization already in progress...", "info");
            return;
        }
        this.isInitializing = true;
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

            // ═══════════════════════════════════════
            // FIX: if a fresh pairing is being requested for this
            // number but this auth folder already has REGISTERED
            // creds (stale / from an earlier failed pairing), clear
            // it first so a brand-new pairing code can be issued and
            // we don't end up in a stale-creds reconnect loop.
            // ═══════════════════════════════════════
            if (pairingNumber && state.creds.registered) {
                this.sendLog("🔄 Existing session found, clearing for fresh pairing...", "info");
                this.isInitializing = false;
                await fs.remove(this.authPath);
                return this.initialize(pairingNumber);
            }

            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: P({ level: 'fatal' }),
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                markOnlineOnConnect: true,
                keepAliveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                emitOwnEvents: true,
                retryRequestDelayMs: 5000,
                maxMsgRetryCount: 5,
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                getMessage: async (key) => {
                    if (messageLogs[key.id]) {
                        return { conversation: messageLogs[key.id].text };
                    }
                    return { conversation: '🤖 Bot is active' };
                },
                patchMessageBeforeSending: (message) => {
                    const requiresPatch = !!(
                        message.buttonsMessage ||
                        message.templateMessage ||
                        message.listMessage
                    );
                    if (requiresPatch) {
                        return {
                            viewOnceMessage: {
                                message: {
                                    messageContextInfo: {
                                        deviceListMetadata: {},
                                        deviceListMetadataVersion: 2
                                    },
                                    ...message
                                }
                            }
                        };
                    }
                    return message;
                },
                generateHighQualityLinkPreview: true,
            });

            if (pairingNumber && !state.creds.registered) {
                if (!this.sock.authState.creds.registered) {
                    await delay(3000);
                    try {
                        let code = await this.sock.requestPairingCode(pairingNumber);
                        code = code?.match(/.{1,4}/g)?.join("-") || code;
                        this.sendLog("🔑 Pairing Code Generated: " + code, 'success');

                        // Send to Telegram if chat ID exists
                        if (this.tgChatId) {
                            const pairingMsg = tgBox("PAIRING CODE", [
                                "  Code    : " + code,
                                "",
                                "  Enter this code in WhatsApp",
                                "  Linked Devices menu.",
                                "  Expires in 60 seconds."
                            ]);
                            await tgBot.sendMessage(this.tgChatId, pairingMsg, { parse_mode: 'Markdown' });
                        }

                        const socketId = userSockets[this.userId];
                        if (socketId) io.to(socketId).emit('pairing-code', code);
                    } catch (err) {
                        this.sendLog("❌ Pairing error: " + err.message, 'error');
                        if (this.tgChatId) {
                            await tgBot.sendMessage(this.tgChatId,
                                tgBox("PAIRING ERROR", [
                                    "  Error   : " + err.message,
                                    "",
                                    "  Please try again with a",
                                    "  valid WhatsApp number."
                                ]),
                                { parse_mode: 'Markdown' }
                            );
                        }
                    }
                }
            }

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('call', async (calls) => {
                if (botData.antiCall[this.userId]) {
                    for (const call of calls) {
                        if (call.status === 'offer') {
                            try {
                                await this.sock.rejectCall(call.id, call.from);
                                await this.sock.sendMessage(call.from, { text: STYLISH.antiCall });
                            } catch (e) {}
                        }
                    }
                }
            });

            this.sock.ev.on('group-participants.update', async (update) => {
                await groupExtra.handleGroupParticipantsUpdate(this.sock, update, botData);
            });

            this.sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;

                await Promise.all(m.messages.map(async (msg) => {
                    // Check for decryption errors
                    if (msg.messageStubType === 1 || msg.messageStubType === 2) {
                        this.sendLog('⚠️ Received undecryptable message. Possible session conflict.', 'warning');
                    }

                    try {
                        const from = msg.key.remoteJid;
                        const isMe = msg.key.fromMe;
                        const isGroup = from.endsWith('@g.us');
                        const isStatus = from === 'status@broadcast';

                        const messageContent = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;
                        if (!messageContent) return;

                        let type = Object.keys(messageContent)[0];
                        const text = (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();

                        // Handle Autoread, Autotyping, Autorecording
                        if (!isMe && !isStatus) {
                            await handleAutoread(this.sock, msg);
                            await storeMessage(msg);
                        }

                        if (msg.message?.protocolMessage?.type === 0) {
                            await handleMessageRevocation(this.sock, msg);
                            return;
                        }

                        const msgId = msg.key.id;
                        if (this.processedMessages.has(msgId)) return;
                        this.processedMessages.add(msgId);
                        if (this.processedMessages.size > 1000) this.processedMessages.delete(this.processedMessages.values().next().value);

                        if (!isStatus) {
                            let logEntry = { text, type };
                            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
                                try {
                                    const mContent = messageContent[type];
                                    if (mContent && (mContent.directPath || mContent.url)) {
                                        const stream = await downloadContentFromMessage(mContent, type.replace('Message', ''));
                                        let buffer = Buffer.from([]);
                                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                                        logEntry.buffer = buffer;
                                    }
                                } catch (e) {}
                            }
                            logEntry.pushName = msg.pushName || 'User';
                            messageLogs[msgId] = logEntry;
                            if (Object.keys(messageLogs).length > 2000) delete messageLogs[Object.keys(messageLogs)[0]];
                        }

                        if (this.autoReact && !isMe && !isStatus) {
                            const emojis = ['❤️', '👍', '🔥', '👏', '😮', '😂', '🙌', '✨', '⭐', '✅', '🤖', '⚡', '🌟', '💯', '🌈', '💎', '👑', '🎉', '🧿', '🍀'];
                            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                            try { await this.sock.sendMessage(from, { react: { text: randomEmoji, key: msg.key } }); } catch (e) {}
                        }

                        // AI Auto-Reply
                        if (this.aiEnabled && !isMe && !isStatus && !isGroup && text && !text.startsWith('.')) {
                            try {
                                const aiResponse = await this.getAIResponse(from, text);
                                await this.sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
                            } catch (e) {
                                console.error("🤖 AI Auto-Reply Error:", e);
                            }
                        }

                        if (isStatus && !isMe) {
                            await handleStatusUpdate(this.sock, m, botData, this.userId);
                            return;
                        }

                        const botNumber = jidNormalizedUser(this.sock.user.id);
                        const sender = msg.key.participant || from;
                        const isOwner = isMe || sender.includes(botNumber.split('@')[0]);
                        let isAdmin = isOwner;
                        if (!isAdmin && isGroup) {
                            try {
                                const groupMetadata = await this.sock.groupMetadata(from);
                                const participant = groupMetadata.participants.find(p => p.id === sender);
                                isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                            } catch (e) {
                                isAdmin = false;
                            }
                        }
                        const cmd = text.toLowerCase();
                        const args = text.split(' ').slice(1);
                        const q = args.join(' ');

                        if (isGroup && botData.antiStatusGroups && botData.antiStatusGroups[from] && !isAdmin) {
                            const isStatusMsg = msg.message?.protocolMessage?.type === 0 ||
                                           msg.message?.viewOnceMessage ||
                                           msg.message?.viewOnceMessageV2 ||
                                           msg.message?.viewOnceMessageV2Extension ||
                                           (text && (text.includes('whatsapp.com/channel/') || text.includes('status@broadcast')));

                            if (msg.message?.forwardingScore > 0 || isStatusMsg) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    return;
                                } catch (e) {}
                            }
                        }

                        if (isGroup && botData.antilinkGroups[from] && !isAdmin) {
                            const linkPatterns = [/chat.whatsapp.com\//i, /http:\/\//i, /https:\/\//i, /www\./i, /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i];
                            if (linkPatterns.some(pattern => pattern.test(text))) {
                                try {
                                    const mode = botData.antilinkGroups[from];
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (mode === 'kick') await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                } catch (e) {}
                                return;
                            }
                        }

                        // ===== NEW UPGRADE: Mute enforcement =====
                        if (isGroup && await groupExtra.handleMuteCheck(this.sock, from, sender, msg, botData)) return;

                        // ===== NEW UPGRADE: Antispam enforcement =====
                        if (isGroup && !isAdmin && await groupExtra.handleAntispam(this.sock, from, sender, msg, botData, isAdmin)) return;

                        // ===== NEW UPGRADE: Rank / activity tracking =====
                        if (isGroup && !cmd.startsWith('.')) socialCmds.trackRank(botData, from, sender);

                        if (!this.isPublic && !isOwner) return;

                        if (cmd.startsWith('.')) {
                            const commandName = cmd.slice(1).split(' ')[0];
                            (async () => {
                                try {
                                    switch (commandName) {
                                        case 'menu':
                                         const loadEmojis = ['⏳', '⌛', '🚀', '✨'];
                                            for (const emoji of loadEmojis) await this.sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
                                            const customName = botData.userNames[this.userId] || msg.pushName || 'User';
                                            const menuUptimeMs = Date.now() - BOT_START_TIME;
                                            const menuUptimeH = Math.floor(menuUptimeMs / 3600000);
                                            const menuUptimeM = Math.floor((menuUptimeMs % 3600000) / 60000);
                                            const menuText = `╭━━━〔 ${toBold("🔥 " + settings.botName + " 🔥")} 〕━━━┈⊷\n` +
`╭─❖───────────────❖─╮\n` +
`┃  ✦ ${toBold("Premium WhatsApp Bot")} ✦\n` +
`┃  ${toBold("Your Cute Little Bot")} 🌸\n` +
`╰─❖───────────────❖─╯\n\n` +

`┃ 👤 ${toBold("𝗨𝘀𝗲𝗿:")} ${customName}\n` +
`┃ 🤖 ${toBold("𝗦𝘁𝗮𝘁𝘂𝘀:")} ${toBold("𝗢𝗻𝗹𝗶𝗻𝗲 ✅")}\n` +
`┃ ⚙️ ${toBold("𝗠𝗼𝗱𝗲:")} ${this.isPublic ? toBold('𝗣𝘂𝗯𝗹𝗶𝗰 🌍') : toBold('𝗣𝗿𝗶𝘃𝗮𝘁𝗲 🔐')}\n` +
`┃ ⏱️ ${toBold("𝗨𝗽𝘁𝗶𝗺𝗲:")} ${menuUptimeH}h ${menuUptimeM}m\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗚𝗘𝗡𝗘𝗥𝗔𝗟 / 𝗨𝗧𝗜𝗟𝗜𝗧𝗬")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗽𝗶𝗻𝗴")}\n` +
`┃ ➤ ${toBold(".𝗼𝘄𝗻𝗲𝗿")}\n` +
`┃ ➤ ${toBold(".𝗱𝗽")}\n` +
`┃ ➤ ${toBold(".𝘃𝘃")}\n` +
`┃ ➤ ${toBold(".𝗴𝗲𝘁")}\n` +
`┃ ➤ ${toBold(".𝗴𝗶𝗳𝘁")}\n` +
`┃ ➤ ${toBold(".𝘁𝗿𝗮𝗻𝘀𝗹𝗮𝘁𝗲 (𝘁𝗲𝘅𝘁)")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗳𝗮𝗰𝗲𝗯𝗼𝗼𝗸 (𝘂𝗿𝗹)")}\n` +
`┃ ➤ ${toBold(".𝘁𝗶𝗸𝘁𝗼𝗸 (𝘂𝗿𝗹)")}\n` +
`┃ ➤ ${toBold(".𝗶𝗻𝘀𝘁𝗮 (𝘂𝗿𝗹)")}\n` +
`┃ ➤ ${toBold(".𝘀𝗼𝗻𝗴 (𝗻𝗮𝗺𝗲)")}\n` +
`┃ ➤ ${toBold(".𝘃𝗶𝗱𝗲𝗼 (𝗻𝗮𝗺𝗲)")}\n` +
`┃ ➤ ${toBold(".𝗮𝗽𝗸 (𝗻𝗮𝗺𝗲)")}\n` +
`┃ ➤ ${toBold(".𝗴𝗱𝗿𝗶𝘃𝗲 (𝘂𝗿𝗹)")}\n` +
`┃ ➤ ${toBold(".𝗺𝗳 (𝘂𝗿𝗹)")}\n` +
`┃ ➤ ${toBold(".𝘄𝗮𝗹𝗹𝗽𝗮𝗽𝗲𝗿 (𝗸𝗲𝘆𝘄𝗼𝗿𝗱)")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗔𝗜 & 𝗠𝗘𝗗𝗜𝗔 𝗧𝗢𝗢𝗟𝗦")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗮𝗶 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝗲𝗺𝗼𝗷𝗶𝗺𝗶𝘅 (𝗲𝟭+𝗲𝟮)")}\n` +
`┃ ➤ ${toBold(".𝗰𝗵𝗮𝗿𝗮𝗰𝘁𝗲𝗿 (𝗺𝗲𝗻𝘁𝗶𝗼𝗻)")}\n` +
`┃ ➤ ${toBold(".𝗿𝗺𝗯𝗴 (𝗿𝗲𝗽𝗹𝘆 𝗶𝗺𝗮𝗴𝗲)")}\n` +
`┃ ➤ ${toBold(".𝗾𝗿 (𝘁𝗲𝘅𝘁)")}\n` +
`┃ ➤ ${toBold(".𝗰𝗮𝗹𝗹𝗶𝗴𝗿𝗮𝗽𝗵𝘆 (𝘁𝗲𝘅𝘁)")}\n` +
`┃ ➤ ${toBold(".𝗰𝗼𝗺𝗽𝗿𝗲𝘀𝘀 (𝗿𝗲𝗽𝗹𝘆)")}\n` +
`┃ ➤ ${toBold(".𝘃𝗰 <𝘁𝘆𝗽𝗲> (𝗿𝗲𝗽𝗹𝘆 𝘃𝗼𝗶𝗰𝗲)")}\n` +
`┃    ↳ robot, deep, bass, chipmunk, high,\n` +
`┃      slow, fast, echo, reverse, nightcore,\n` +
`┃      demon, male, female, alien, telephone,\n` +
`┃      underwater, whisper\n` +
`┃ ➤ ${toBold(".𝗰𝗵𝗮𝗻𝗻𝗲𝗹𝗶𝗱 (𝗹𝗶𝗻𝗸)")}\n` +
`┃ ➤ ${toBold(".𝘄𝗲𝗮𝘁𝗵𝗲𝗿 (𝗰𝗶𝘁𝘆)")}\n` +
`┃ ➤ ${toBold(".𝘁𝗺𝗽")}\n` +
`┃ ➤ ${toBold(".𝘁𝗺𝗽𝗶𝗯")}\n` +
`┃ ➤ ${toBold(".𝘁𝗺𝗽𝗿𝘀𝘁")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗣𝗥𝗜𝗩𝗔𝗖𝗬 & 𝗦𝗘𝗖𝗨𝗥𝗜𝗧𝗬")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗽𝗿𝗶𝘃𝗮𝘁𝗲")}\n` +
`┃ ➤ ${toBold(".𝗽𝘂𝗯𝗹𝗶𝗰")}\n` +
`┃ ➤ ${toBold(".𝗮𝘂𝘁𝗼𝗿𝗲𝗮𝗰𝘁 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝗮𝘂𝘁𝗼𝗿𝗲𝗮𝗱 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝗮𝗻𝘁𝗶𝗹𝗶𝗻𝗸 [𝗼𝗻/𝗼𝗳𝗳/𝗸𝗶𝗰𝗸]")}\n` +
`┃ ➤ ${toBold(".𝗮𝗻𝘁𝗶𝗱𝗲𝗹𝗲𝘁𝗲 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝗮𝗻𝘁𝗶𝗰𝗮𝗹𝗹 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝗮𝗻𝘁𝗶𝘀𝘁𝗮𝘁𝘂𝘀 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝗸𝗶𝗰𝗸𝗼𝗳𝗳𝗹𝗶𝗻𝗲 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝗯𝗹𝗼𝗰𝗸")} / ${toBold(".𝘂𝗻𝗯𝗹𝗼𝗰𝗸 (𝗿𝗲𝗽𝗹𝘆)")}\n` +
`┃ ➤ ${toBold(".𝗵𝗮𝗰𝗸")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗚𝗥𝗢𝗨𝗣 𝗔𝗗𝗠𝗜𝗡")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗵𝗶𝗱𝗲𝘁𝗮𝗴")}\n` +
`┃ ➤ ${toBold(".𝘁𝗮𝗴𝗮𝗹𝗹")}\n` +
`┃ ➤ ${toBold(".𝘀𝗲𝘁𝗻𝗮𝗺𝗲 (𝗻𝗮𝗺𝗲)")}\n` +
`┃ ➤ ${toBold(".𝗴𝗿𝗼𝘂𝗽𝗶𝗻𝗳𝗼")}\n` +
`┃ ➤ ${toBold(".𝗴𝗿𝗼𝘂𝗽𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀")}\n` +
`┃ ➤ ${toBold(".𝗮𝗰𝗰𝗲𝗽𝘁")}\n` +
`┃ ➤ ${toBold(".𝘄𝗮𝗿𝗻")} / ${toBold(".𝘂𝗻𝘄𝗮𝗿𝗻 (𝗿𝗲𝗽𝗹𝘆)")}\n` +
`┃ ➤ ${toBold(".𝗺𝘂𝘁𝗲")} / ${toBold(".𝘂𝗻𝗺𝘂𝘁𝗲 (𝗿𝗲𝗽𝗹𝘆)")}\n` +
`┃ ➤ ${toBold(".𝗽𝗿𝗼𝗺𝗼𝘁𝗲")} / ${toBold(".𝗱𝗲𝗺𝗼𝘁𝗲 (𝗿𝗲𝗽𝗹𝘆)")}\n` +
`┃ ➤ ${toBold(".𝘄𝗲𝗹𝗰𝗼𝗺𝗲")} / ${toBold(".𝗴𝗼𝗼𝗱𝗯𝘆𝗲 [𝗼𝗻/𝗼𝗳𝗳/𝘀𝗲𝘁]")}\n` +
`┃ ➤ ${toBold(".𝗮𝗻𝘁𝗶𝘀𝗽𝗮𝗺 [𝗼𝗻/𝗼𝗳𝗳]")}\n` +
`┃ ➤ ${toBold(".𝘀𝘁𝗮𝘁𝘂𝘀 [𝗼𝗻/𝗼𝗳𝗳/𝘀𝗲𝗲𝗻/𝗹𝗶𝗸𝗲/𝗱𝗼𝘄𝗻𝗹𝗼𝗮𝗱/𝘀𝘆𝘀𝘁𝗲𝗺]")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗙𝗨𝗡 & 𝗚𝗔𝗠𝗘𝗦")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝘁𝗿𝘂𝘁𝗵")} / ${toBold(".𝗱𝗮𝗿𝗲")}\n` +
`┃ ➤ ${toBold(".𝗾𝘂𝗶𝘇")}\n` +
`┃ ➤ ${toBold(".𝗿𝗽𝗴 [𝘄𝗼𝗿𝗸/𝗱𝗮𝗶𝗹𝘆]")}\n` +
`┃ ➤ ${toBold(".𝘀𝗵𝗶𝗽 (𝘁𝗮𝗴 𝟮)")}\n` +
`┃ ➤ ${toBold(".𝗰𝗼𝘂𝗽𝗹𝗲")}\n` +
`┃ ➤ ${toBold(".𝗿𝗼𝗮𝘀𝘁")} / ${toBold(".𝗰𝗼𝗺𝗽𝗹𝗶𝗺𝗲𝗻𝘁")}\n` +
`┃ ➤ ${toBold(".𝗷𝗼𝗸𝗲")}\n` +
`┃ ➤ ${toBold(".𝗺𝗲𝗺𝗲")}\n` +
`┃ ➤ ${toBold(".𝗰𝗼𝗻𝗳𝗲𝘀𝘀 (𝘁𝗲𝘅𝘁)")}\n` +
`┃ ➤ ${toBold(".𝗽𝗼𝗹𝗹 𝗾𝘂𝗲𝘀𝘁𝗶𝗼𝗻 | 𝗼𝗽𝘁𝟭 | 𝗼𝗽𝘁𝟮")}\n` +
`┃ ➤ ${toBold(".𝗿𝗮𝗻𝗸")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗣𝗢𝗘𝗧𝗥𝗬 & 𝗧𝗘𝗫𝗧")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗽𝗼𝗲𝘁𝗿𝘆 (𝘁𝗼𝗽𝗶𝗰)")}\n` +
`┃ ➤ ${toBold(".𝗾𝘂𝗼𝘁𝗲")}\n` +
`┃ ➤ ${toBold(".𝘄𝗼𝗿𝗱𝗺𝗲𝗮𝗻𝗶𝗻𝗴 (𝘄𝗼𝗿𝗱)")}\n` +
`┃ ➤ ${toBold(".𝘀𝗽𝗲𝗹𝗹𝗰𝗵𝗲𝗰𝗸 (𝘁𝗲𝘅𝘁)")}\n` +
`┃ ➤ ${toBold(".𝗿𝗵𝘆𝗺𝗲 (𝘄𝗼𝗿𝗱)")}\n` +
`┃ ➤ ${toBold(".𝗮𝗰𝗿𝗼𝘀𝘁𝗶𝗰 (𝗻𝗮𝗺𝗲)")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗜𝗦𝗟𝗔𝗠𝗜𝗖")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗵𝗮𝗱𝗶𝘁𝗵")}\n` +
`┃ ➤ ${toBold(".𝗾𝘂𝗿𝗮𝗻")}\n` +
`┃ ➤ ${toBold(".𝗽𝗿𝗮𝘆𝗲𝗿𝘁𝗶𝗺𝗲 (𝗰𝗶𝘁𝘆)")}\n` +
`┃ ➤ ${toBold(".𝗱𝘂𝗮")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗗𝗔𝗜𝗟𝗬 𝗨𝗧𝗜𝗟𝗜𝗧𝗬")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗿𝗲𝗺𝗶𝗻𝗱𝗲𝗿 (𝟭𝟬𝘀/𝟱𝗺/𝟮𝗵) (𝘁𝗲𝘅𝘁)")}\n` +
`┃ ➤ ${toBold(".𝘁𝗼𝗱𝗼 [𝗮𝗱𝗱/𝗱𝗼𝗻𝗲/𝗰𝗹𝗲𝗮𝗿]")}\n` +
`┃ ➤ ${toBold(".𝗰𝗮𝗹𝗰 (𝗲𝘅𝗽𝗿𝗲𝘀𝘀𝗶𝗼𝗻)")}\n` +
`┃ ➤ ${toBold(".𝗱𝗲𝗳𝗶𝗻𝗲 (𝘄𝗼𝗿𝗱)")}\n` +
`┃ ➤ ${toBold(".𝗳𝗮𝗰𝘁")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`▓▒░ ${toBold("𝗢𝗪𝗡𝗘𝗥 𝗧𝗢𝗢𝗟𝗦")} ░▒▓\n` +
`┃ ➤ ${toBold(".𝗯𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 (𝘁𝗲𝘅𝘁)")}\n` +
`┃ ➤ ${toBold(".𝘀𝘁𝗮𝘁𝘀")}\n` +
`┃ ➤ ${toBold(".𝗯𝗮𝗰𝗸𝘂𝗽")}\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`「 ⚡ ${toBold("𝗤𝗨𝗜𝗖𝗞 𝗧𝗜𝗣")} 」\n` +
`┃ ➤ ${toBold(".𝗵𝗲𝗹𝗽 <𝗰𝗼𝗺𝗺𝗮𝗻𝗱")} se detail milegi 🌸\n` +
`╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈❖\n\n` +

`╭─❖───────────────❖─╮\n` +
`┃ 🚀 ${toBold(settings.ownerName)}\n` +
`┃ ✧ ${toBold(settings.botName + " · v2.0 Premium")}\n` +
`╰─❖───────────────❖─╯`;

                                            const channelContext = {
                                                forwardingScore: 999,
                                                isForwarded: true,
                                                forwardedNewsletterMessageInfo: {
                                                    newsletterJid: settings.newsletterJid,
                                                    newsletterName: settings.botName,
                                                    serverMessageId: 1
                                                }
                                            };
                                            try {
                                                await this.sock.sendMessage(from, { image: { url: settings.menuImage }, caption: menuText, contextInfo: channelContext });
                                            } catch (e) { await this.sock.sendMessage(from, { text: menuText, contextInfo: channelContext }); }
                                            break;
                                        case 'help':
                                        const helpText = `╭━━━〔 ${toBold("📖 " + settings.botName + " HELP")} 〕━━━┈⊷

▓▒░ ${toBold("𝗨𝗧𝗜𝗟𝗜𝗧𝗬")} ░▒▓
┃ .ping — Bot speed check karo
┃ .owner — Owner ka contact dikhata hai
┃ .dp — Kisi ki profile pic nikalta hai
┃ .vv — View-once media dobara dekho
┃ .translate <text> — Text translate karta hai

▓▒░ ${toBold("𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗")} ░▒▓
┃ .song <naam> — Gaana download karta hai
┃ .video <naam> — Video download karta hai
┃ .insta <url> — Instagram post/reel download
┃ .tiktok <url> — TikTok video download
┃ .facebook <url> — FB video download
┃ .apk <naam> — App ka APK dhoondta hai

▓▒░ ${toBold("𝗔𝗜 & 𝗠𝗘𝗗𝗜𝗔")} ░▒▓
┃ .ai on/off — AI auto-reply on/off karta hai
┃ .rmbg — Reply image pe background hata deta hai
┃ .qr <text> — QR code banata hai
┃ .vc <type> — Reply voice ki awaz change karta hai
┃ .emojimix <e1+e2> — Do emoji mix karta hai

▓▒░ ${toBold("𝗚𝗥𝗢𝗨𝗣 𝗔𝗗𝗠𝗜𝗡")} ░▒▓
┃ .warn — Reply karke user ko warning deta hai (3/3 = kick)
┃ .mute/unmute — Reply karke user ko mute/unmute karta hai
┃ .promote/demote — Reply karke admin bana/hata deta hai
┃ .welcome on/off/set — Naye member ka welcome msg control
┃ .goodbye on/off/set — Chale jane wale ka msg control
┃ .antilink on/off/kick — Group mein link block karta hai
┃ .antispam on/off — Spam karne walon ko rokta hai
┃ .tagall/.hidetag — Sab members ko tag karta hai

▓▒░ ${toBold("𝗙𝗨𝗡")} ░▒▓
┃ .truth/.dare — Random truth ya dare deta hai
┃ .quiz — Quiz question deta hai
┃ .rpg work/daily — Virtual coins kamao
┃ .ship — Do logon ko "ship" karta hai
┃ .roast/.compliment — Reply karke roast/tareef karta hai

▓▒░ ${toBold("𝗜𝗦𝗟𝗔𝗠𝗜𝗖")} ░▒▓
┃ .hadith — Random hadith deta hai
┃ .quran — Quran ki ayat deta hai
┃ .prayertime <city> — Namaz ka waqt batata hai
┃ .dua — Random dua deta hai

▓▒░ ${toBold("𝗗𝗔𝗜𝗟𝗬 𝗨𝗧𝗜𝗟𝗜𝗧𝗬")} ░▒▓
┃ .reminder <time> <text> — Reminder set karta hai
┃ .todo add/done/clear — To-do list manage karta hai
┃ .calc <expression> — Calculator
┃ .define <word> — Word ka meaning batata hai

╰━━━━━━━━━━━━━━━━━━┈⊷
${toBold("Poori list ke liye .menu likho")} 🌸`;
                                        await this.sock.sendMessage(from, { text: helpText }, { quoted: msg });
                                        break;
                                        case 'ping': await commands.ping(this.sock, from, msg); break;
                                        case 'owner': await commands.owner(this.sock, from, msg); break;
                                        case 'ai': await commands.ai(this.sock, from, msg, isAdmin, this, args); break;
                                        case 'antilink': await commands.antilink(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'anticall': await commands.anticall(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'antidelete': await commands.antidelete(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'status':
                                        case 'autostatus': await commands.autostatus(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'autoreacts': await commands.autoreacts(this.sock, from, msg, isAdmin, this, args); break;
                                        case 'kick': await commands.kick(this.sock, from, msg, isAdmin); break;
                                        case 'private':
                                            await commands.private(this.sock, from, msg, isAdmin, this);
                                            if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                            botData.statusSettings[this.userId].isPublic = false;
                                            saveBotData();
                                            break;
                                        case 'public':
                                            await commands.public(this.sock, from, msg, isAdmin, this);
                                            if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                            botData.statusSettings[this.userId].isPublic = true;
                                            saveBotData();
                                            break;
                                        case 'hidetag': await commands.hidetag(this.sock, from, msg, isAdmin, q); break;
                                        case 'tagall': await commands.tagall(this.sock, from, msg, isAdmin, q); break;
                                        case 'setname': await commands.setname(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, q); break;
                                        case 'insta': case 'ig': await commands.insta(this.sock, from, msg, q); break;
                                        case 'tiktok': await commands.tiktok(this.sock, from, msg, q); break;
                                        case 'song': await commands.song(this.sock, from, msg); break;
                                        case 'video': await commands.video(this.sock, from, msg); break;
                                        case 'joke': await commands.joke(this.sock, from, msg); break;
                                        case 'meme': await commands.meme(this.sock, from, msg); break;
                                        case 'weather': await commands.weather(this.sock, from, msg); break;
                                        case 'wallpaper': await commands.wallpaper(this.sock, from, msg); break;
                                        case 'tmp': await commands.tmp(this.sock, from, msg); break;
                                        case 'tmpib': await commands.tmpib(this.sock, from, msg); break;
                                        case 'rmbg': await commands.rmbg(this.sock, from, msg); break;
                                        case 'tmprst': await commands.tmprst(this.sock, from, msg); break;
                                        case 'vv': await commands.vv(this.sock, from, msg); break;
                                        case 'dp': await commands.dp(this.sock, from, msg); break;
                                        case 'groupinfo': await commands.groupinfo(this.sock, from, msg); break;
                                        case 'kickoffline': await commands.kickoffline(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'antistatus': await commands.antistatus(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'gdrive': await commands.gdrive(this.sock, from, msg, q); break;
                                        case 'mf': await commands.mf(this.sock, from, msg, q); break;
                                        case 'translate': case 'trt': await commands.translate(this.sock, from, msg, q); break;

                                        // New Command Handlers
                                        case 'apk': await commands.apk(this.sock, from, msg); break;
                                        case 'autoread': await commands.autoread(this.sock, from, msg); break;
                                        case 'character': await commands.character(this.sock, from, msg); break;
                                        case 'emojimix': await commands.emojimix(this.sock, from, msg); break;
                                        case 'facebook': case 'fb': await commands.facebook(this.sock, from, msg); break;
                                        case 'hack': await commands.hack(this.sock, from, msg); break;
                                        case 'accept': await commands.accept(this.sock, from, msg, isAdmin); break;
                                        case 'get': await commands.get(this.sock, from, msg, q, args); break;
                                        case 'gift': await commands.gift(this.sock, from, msg, q, args); break;
                                        case 'channelid': await commands.channelid(this.sock, from, msg, q); break;

                                        // ===== NEW UPGRADE: Group Management =====
                                        case 'warn': await groupExtra.warnCommand(this.sock, from, msg, isAdmin, botData, saveBotData); break;
                                        case 'unwarn': await groupExtra.unwarnCommand(this.sock, from, msg, isAdmin, botData, saveBotData); break;
                                        case 'mute': await groupExtra.muteCommand(this.sock, from, msg, isAdmin, botData, saveBotData); break;
                                        case 'unmute': await groupExtra.unmuteCommand(this.sock, from, msg, isAdmin, botData, saveBotData); break;
                                        case 'welcome': await groupExtra.welcomeCommand(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'goodbye': await groupExtra.goodbyeCommand(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'promote': await groupExtra.promoteCommand(this.sock, from, msg, isAdmin); break;
                                        case 'demote': await groupExtra.demoteCommand(this.sock, from, msg, isAdmin); break;
                                        case 'groupsettings': await groupExtra.groupsettingsCommand(this.sock, from, msg, isAdmin, botData); break;
                                        case 'antispam': await groupExtra.antispamCommand(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;

                                        // ===== NEW UPGRADE: Fun / Games =====
                                        case 'truth': await funCmds.truthCommand(this.sock, from, msg); break;
                                        case 'dare': await funCmds.dareCommand(this.sock, from, msg); break;
                                        case 'quiz': await funCmds.quizCommand(this.sock, from, msg, args); break;
                                        case 'rpg': case 'economy': await funCmds.rpgCommand(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'ship': await funCmds.shipCommand(this.sock, from, msg); break;
                                        case 'roast': await funCmds.roastCommand(this.sock, from, msg); break;
                                        case 'compliment': await funCmds.complimentCommand(this.sock, from, msg); break;

                                        // ===== NEW UPGRADE: Owner / Admin Tools =====
                                        case 'broadcast': await adminTools.broadcastCommand(this.sock, from, msg, isOwner, args); break;
                                        case 'stats': await adminTools.statsCommand(this.sock, from, msg, botData, BOT_START_TIME); break;
                                        case 'backup': await adminTools.backupCommand(this.sock, from, msg, isOwner); break;
                                        case 'block': await adminTools.blockCommand(this.sock, from, msg, isOwner, botData, saveBotData); break;
                                        case 'unblock': await adminTools.unblockCommand(this.sock, from, msg, isOwner, botData, saveBotData); break;

                                        // ===== NEW UPGRADE: Poetry / Text / Language (AI powered) =====
                                        case 'poetry': case 'shayari': await textAi.poetryCommand(this.sock, from, msg, this, args); break;
                                        case 'quote': await textAi.quoteCommand(this.sock, from, msg); break;
                                        case 'wordmeaning': await textAi.wordmeaningCommand(this.sock, from, msg, this, args); break;
                                        case 'spellcheck': await textAi.spellcheckCommand(this.sock, from, msg, this, args); break;
                                        case 'rhyme': await textAi.rhymeCommand(this.sock, from, msg, this, args); break;
                                        case 'acrostic': await textAi.acrosticCommand(this.sock, from, msg, this, args); break;

                                        // ===== NEW UPGRADE: Islamic =====
                                        case 'hadith': await islamicCmds.hadithCommand(this.sock, from, msg); break;
                                        case 'quran': await islamicCmds.quoteQuranCommand(this.sock, from, msg); break;
                                        case 'prayertime': await islamicCmds.prayertimeCommand(this.sock, from, msg, args); break;
                                        case 'dua': await islamicCmds.duaCommand(this.sock, from, msg); break;

                                        // ===== NEW UPGRADE: Daily Utility =====
                                        case 'reminder': await utilityCmds.reminderCommand(this.sock, from, msg, botData, saveBotData, this.userId, args); break;
                                        case 'todo': await utilityCmds.todoCommand(this.sock, from, msg, botData, saveBotData, this.userId, args); break;
                                        case 'calc': await utilityCmds.calcCommand(this.sock, from, msg, args); break;
                                        case 'define': await utilityCmds.defineCommand(this.sock, from, msg, args); break;
                                        case 'fact': await utilityCmds.factCommand(this.sock, from, msg); break;

                                        // ===== NEW UPGRADE: Social / Interactive =====
                                        case 'confess': await socialCmds.confessCommand(this.sock, from, msg, args); break;
                                        case 'poll': await socialCmds.pollCommand(this.sock, from, msg, args); break;
                                        case 'couple': await socialCmds.coupleCommand(this.sock, from, msg); break;
                                        case 'rank': await socialCmds.rankCommand(this.sock, from, msg, botData); break;

                                        // ===== NEW UPGRADE: Local Media (no API key) =====
                                        case 'qr': await mediaLocal.qrCommand(this.sock, from, msg, args); break;
                                        case 'calligraphy': await mediaLocal.calligraphyCommand(this.sock, from, msg, args); break;
                                        case 'compress': await mediaLocal.compressCommand(this.sock, from, msg); break;

                                        // ===== NEW UPGRADE: Voice Changer =====
                                        case 'vc': case 'voicechanger': await vcCommand(this.sock, from, msg, args); break;
                                    }
                                } catch (e) {
                                    this.sendLog("❌ Command error (" + commandName + "): " + e.message, 'error');
                                }
                            })();
                        }
                    } catch (e) {
                        console.error('❌ Message Processing Error:', e);
                    }
                }));
            });

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    const socketId = userSockets[this.userId];
                    if (socketId) io.to(socketId).emit('qr', qr);
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    this.isConnected = false;
                    this.isInitializing = false;
                    this.sendLog("⚠️ Connection closed. Reconnecting: " + shouldReconnect, 'warning');
                    this.sendConnectionStatus();
                    const statusCode = (lastDisconnect.error)?.output?.statusCode;

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        this.sendLog('🔴 Session expired or logged out. Clearing auth data for fresh pairing...', 'error');
                        // Send disconnected message to own DM
                        try {
                            const botNumber = jidNormalizedUser(this.sock.user.id);
                            await this.sock.sendMessage(botNumber, { text: STYLISH.disconnected });
                        } catch (e) {}
                        try {
                            if (fs.existsSync(this.authPath)) {
                                const backupPath = this.authPath + '_backup_' + Date.now();
                                fs.moveSync(this.authPath, backupPath);
                                this.sendLog("📦 Corrupted session backed up to " + backupPath, 'info');
                            }
                        } catch (e) {
                            if (fs.existsSync(this.authPath)) fs.removeSync(this.authPath);
                        }
                        delete sessions[this.userId];
                        this.sendConnectionStatus();
                    } else if (statusCode === DisconnectReason.restartRequired || statusCode === DisconnectReason.connectionLost || statusCode === 428) {
                        this.sendLog("🔄 Connection issue (" + statusCode + "). Restarting in 3s...", 'warning');
                        setTimeout(() => this.initialize(), 3000);
                    } else if (statusCode === 515) {
                        this.sendLog('⚠️ Stream error. Reconnecting immediately...', 'warning');
                        this.initialize();
                    } else {
                        this.sendLog("ℹ️ Connection closed (" + statusCode + "). Reconnecting in 5s...", 'info');
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    this.isInitializing = false;
                    this.sendLog('✅ Connected successfully!', 'success');
                    this.sendConnectionStatus();
                    this.startActiveCheck();

                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    const botName = botData.userNames[this.userId] || (this.sock.user && this.sock.user.name) || this.userId;

                    // Send connected message to Telegram
                    if (this.tgChatId) {
                        await tgBot.sendMessage(this.tgChatId,
                            tgBox("WHATSAPP CONNECTED", [
                                "  Bot Name : " + botName,
                                "  Number   : " + this.userId,
                                "  Status   : Active & Running",
                                "",
                                "  Your bot is now ready to use."
                            ]),
                            { parse_mode: 'Markdown' }
                        );
                    }

                    this.sendLog("🌟 Bot " + botName + " is online and ready!", 'success');

                    setTimeout(async () => {
                        try {
                            await this.sock.query({
                                tag: 'iq',
                                attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                                content: [{ tag: 'status', attrs: {}, content: Buffer.from(`🌟 IM USING BEST BOT ${settings.botName} 🌟`, 'utf-8') }]
                            });
                            this.sendLog("✨ Bio updated successfully!", "success");
                        } catch (e) {
                            this.sendLog("⚠️ Bio update failed: " + e.message, "error");
                        }
                    }, 5000);

                    // Send SUPER STYLISH connected message
                    if (!this.lastConnectMessageTime || (Date.now() - this.lastConnectMessageTime > 60 * 60 * 1000)) {
                        await this.sock.sendMessage(botNumber, { text: STYLISH.connected });
                        this.lastConnectMessageTime = Date.now();
                    }
                }
            });

        } catch (err) {
            this.isInitializing = false;
            this.sendLog("❌ Initialization failed: " + err.message + ". Retrying in 10s...", 'error');
            setTimeout(() => this.initialize(), 10000);
        }
    }
}

io.on('connection', (socket) => {
    socket.on('set-user', (userId) => {
        userSockets[userId] = socket.id;
        if (!sessions[userId]) sessions[userId] = new BotSession(userId);
        sessions[userId].sendConnectionStatus();
    });

    socket.on('pair-request', async ({ userId, number }) => {
        if (sessions[userId]) {
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = {
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: false
                };
                saveBotData();
            }
            await sessions[userId].initialize(number);
        }
    });

    socket.on('logout', async (userId) => {
        await logoutSession(userId);
    });

    socket.on('disconnect', () => {
        for (const userId in userSockets) {
            if (userSockets[userId] === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n' +
    '   ⚡ ' + settings.botName + ' — SERVER ⚡\n' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n\n' +
    '  [■] Core Engine ......... booted\n' +
    '  [■] Server .............. http://localhost:' + PORT + '\n' +
    '  [■] Status ............... 🟢 ONLINE\n' +
    '  [■] Anti-Sleep ........... enabled (5min)\n' +
    '  [■] Owner ................ ' + settings.ownerName + '\n\n' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n');

    // Auto-load sessions
    loadExistingSessions();

    // Anti-Sleep Mechanism
    const APP_URL = process.env.APP_URL || 'http://localhost:' + PORT;
    if (APP_URL) {
        setInterval(async () => {
            try {
                await axios.get(APP_URL);
                console.log('⚡ 𝗔𝗻𝘁𝗶-𝗦𝗹𝗲𝗲𝗽 𝗣𝗶𝗻𝗴 ➜ 𝗦𝗲𝗿𝘃𝗲𝗿 𝗔𝗰𝘁𝗶𝘃𝗲');
            } catch (e) {
                console.log('⚠️ 𝗔𝗻𝘁𝗶-𝗦𝗹𝗲𝗲𝗽 𝗣𝗶𝗻𝗴 ➜ ' + e.message);
            }
        }, 8 * 60 * 1000); // Ping every 5 minutes
    }
});