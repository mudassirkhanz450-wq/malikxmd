// commands/text-ai.js - Poetry, Quote, WordMeaning, Spellcheck, Rhyme, Acrostic
// Uses session.getAIResponse (existing OpenRouter/OpenAI key) - no new API needed

const quotes = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Believe you can and you're halfway there.",
    "The only way to do great work is to love what you do.",
    "Your time is limited, don't waste it living someone else's life.",
    "It always seems impossible until it's done.",
    "Khwabon ko hakikat banane ke liye pehle unhe dekhna zaroori hai.",
    "Mushkilein zindagi ka hissa hain, hosla unka ilaj hai.",
    "Waqt kabhi kisi ka intezar nahi karta, khud waqt ke saath chalna seekho."
];

async function quoteCommand(sock, from, msg) {
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    await sock.sendMessage(from, { text: `💭 *QUOTE*\n\n"${q}"` }, { quoted: msg });
}

async function poetryCommand(sock, from, msg, session, args) {
    const topic = args.join(' ') || 'zindagi';
    try {
        await sock.sendMessage(from, { react: { text: '✍️', key: msg.key } });
        const prompt = `Write a short original 4-line Urdu shayari (in Roman Urdu script) about "${topic}". Only output the shayari lines, nothing else.`;
        const response = await session.getAIResponse(from, prompt);
        await sock.sendMessage(from, { text: `📜 *SHAYARI*\n\n${response}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error generating poetry: " + e.message }, { quoted: msg });
    }
}

async function wordmeaningCommand(sock, from, msg, session, args) {
    const word = args.join(' ');
    if (!word) return await sock.sendMessage(from, { text: "❌ Usage: .wordmeaning <word>" }, { quoted: msg });
    try {
        const prompt = `Give the English meaning and Urdu translation of the word "${word}" in this exact short format:\nMeaning: ...\nUrdu: ...\nExample: ...`;
        const response = await session.getAIResponse(from, prompt);
        await sock.sendMessage(from, { text: `📖 *${word.toUpperCase()}*\n\n${response}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
}

async function spellcheckCommand(sock, from, msg, session, args) {
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: "❌ Usage: .spellcheck <text>" }, { quoted: msg });
    try {
        const prompt = `Correct any spelling and grammar mistakes in this text and return ONLY the corrected version:\n"${text}"`;
        const response = await session.getAIResponse(from, prompt);
        await sock.sendMessage(from, { text: `✅ *Corrected:*\n\n${response}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
}

async function rhymeCommand(sock, from, msg, session, args) {
    const word = args.join(' ');
    if (!word) return await sock.sendMessage(from, { text: "❌ Usage: .rhyme <word>" }, { quoted: msg });
    try {
        const prompt = `Give 8 words that rhyme with "${word}". Reply as a simple comma-separated list only.`;
        const response = await session.getAIResponse(from, prompt);
        await sock.sendMessage(from, { text: `🎵 *Rhymes with "${word}":*\n\n${response}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
}

async function acrosticCommand(sock, from, msg, session, args) {
    const name = args.join(' ');
    if (!name) return await sock.sendMessage(from, { text: "❌ Usage: .acrostic <name/word>" }, { quoted: msg });
    try {
        const prompt = `Write a short acrostic poem where each line starts with each letter of the word "${name}" in order. Output only the poem.`;
        const response = await session.getAIResponse(from, prompt);
        await sock.sendMessage(from, { text: `✨ *ACROSTIC — ${name.toUpperCase()}*\n\n${response}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
}

module.exports = {
    quoteCommand, poetryCommand, wordmeaningCommand, spellcheckCommand, rhymeCommand, acrosticCommand
};
