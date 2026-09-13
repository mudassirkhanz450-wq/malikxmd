// commands/fun.js - Truth/Dare, Quiz, RPG/Economy, Ship, Roast/Compliment

const truths = [
    "Aapki sabse embarrassing memory kya hai?",
    "Aapne kabhi kisi se jhoot bola jo pakda gaya?",
    "Aapka secret crush kaun tha?",
    "Aapne kabhi kisi ka phone check kiya hai?",
    "Aapki sabse badi weakness kya hai?",
    "Aap kis cheez se sabse zyada darte hain?",
    "Aapne kabhi exam me cheating ki hai?",
    "Sabse ajeeb sapna kya dekha hai?"
];

const dares = [
    "Apni last 5 sent messages padh kar sunao.",
    "Group me sabse ajeeb selfie bhejo.",
    "1 minute tak bina rukе sing karo (voice note).",
    "Apna current mood emoji se batao (10 emojis).",
    "Apne phone ka wallpaper share karo.",
    "Kisi ko random compliment do group me.",
    "Apni voice me favorite dialogue bolo.",
    "Bina vowels ke ek sentence type karo."
];

const quizzes = [
    { q: "Pakistan ka sabse bada shehar kaunsa hai?", a: "karachi" },
    { q: "Duniya ka sabse bada sahara kaunsa hai?", a: "sahara" },
    { q: "HTML ka full form kya hai?", a: "hypertext markup language" },
    { q: "Insan ke jism me kitni haddiyan hoti hain?", a: "206" },
    { q: "Pani ka chemical formula kya hai?", a: "h2o" },
    { q: "Sabse chota planet kaunsa hai?", a: "mercury" }
];

async function truthCommand(sock, from, msg) {
    const t = truths[Math.floor(Math.random() * truths.length)];
    await sock.sendMessage(from, { text: `🎭 *TRUTH*\n\n${t}` }, { quoted: msg });
}

async function dareCommand(sock, from, msg) {
    const d = dares[Math.floor(Math.random() * dares.length)];
    await sock.sendMessage(from, { text: `🔥 *DARE*\n\n${d}` }, { quoted: msg });
}

const activeQuiz = {};
async function quizCommand(sock, from, msg, args) {
    const answer = args.join(' ').toLowerCase().trim();
    if (activeQuiz[from] && answer) {
        if (answer === activeQuiz[from].a) {
            await sock.sendMessage(from, { text: "✅ Correct answer! 🎉" }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `❌ Wrong! Correct answer: *${activeQuiz[from].a}*` }, { quoted: msg });
        }
        delete activeQuiz[from];
        return;
    }
    const pick = quizzes[Math.floor(Math.random() * quizzes.length)];
    activeQuiz[from] = pick;
    await sock.sendMessage(from, { text: `🧠 *QUIZ TIME*\n\n${pick.q}\n\nReply: .quiz <your answer>` }, { quoted: msg });
}

async function rpgCommand(sock, from, msg, isAdmin, botData, saveBotData, userId, args) {
    if (!botData.economy) botData.economy = {};
    if (!botData.economy[userId]) botData.economy[userId] = { coins: 100, level: 1 };
    const player = botData.economy[userId];
    const action = args[0]?.toLowerCase();

    if (action === 'work') {
        const earned = Math.floor(Math.random() * 50) + 10;
        player.coins += earned;
        saveBotData();
        await sock.sendMessage(from, { text: `💼 Aapne kaam karke *${earned} coins* kamaye!\n💰 Total: ${player.coins} coins | ⭐ Level ${player.level}` }, { quoted: msg });
    } else if (action === 'daily') {
        const earned = 100;
        player.coins += earned;
        saveBotData();
        await sock.sendMessage(from, { text: `🎁 Daily bonus: *+${earned} coins*!\n💰 Total: ${player.coins} coins` }, { quoted: msg });
    } else {
        await sock.sendMessage(from, { text: `👤 *Your Profile*\n\n💰 Coins: ${player.coins}\n⭐ Level: ${player.level}\n\nUsage: .rpg [work/daily]` }, { quoted: msg });
    }
}

async function shipCommand(sock, from, msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const percent = Math.floor(Math.random() * 101);
    let name1 = "Person A", name2 = "Person B";
    if (mentioned.length >= 2) {
        name1 = `@${mentioned[0].split('@')[0]}`;
        name2 = `@${mentioned[1].split('@')[0]}`;
    }
    let bar = '💗'.repeat(Math.round(percent / 10)) + '🤍'.repeat(10 - Math.round(percent / 10));
    await sock.sendMessage(from, { text: `💘 *SHIP CALCULATOR*\n\n${name1} + ${name2}\n\n${bar}\n\n${percent}% Compatibility!`, mentions: mentioned }, { quoted: msg });
}

const roasts = [
    "Aap itne unique ho ke Google bhi aapko search nahi kar sakta.",
    "Aapki soch itni fast hai ke 56k internet bhi tez lagta hai.",
    "Agar overthinking olympic event hoti to aap gold medalist hote.",
    "Aap wo insaan ho jinke liye '404 not found' banaya gaya tha."
];

const compliments = [
    "Aap kaafi talented ho, apni value pehchaano!",
    "Aapki smile din bana deti hai.",
    "Aap jo bhi karte ho, dil se karte ho — that's rare.",
    "Aapke saath baat karke acha lagta hai, positive energy!"
];

async function roastCommand(sock, from, msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const r = roasts[Math.floor(Math.random() * roasts.length)];
    const tag = mentioned ? `@${mentioned.split('@')[0]} ` : '';
    await sock.sendMessage(from, { text: `🔥 ${tag}${r}`, mentions: mentioned ? [mentioned] : [] }, { quoted: msg });
}

async function complimentCommand(sock, from, msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const c = compliments[Math.floor(Math.random() * compliments.length)];
    const tag = mentioned ? `@${mentioned.split('@')[0]} ` : '';
    await sock.sendMessage(from, { text: `✨ ${tag}${c}`, mentions: mentioned ? [mentioned] : [] }, { quoted: msg });
}

module.exports = {
    truthCommand, dareCommand, quizCommand, rpgCommand, shipCommand, roastCommand, complimentCommand
};
