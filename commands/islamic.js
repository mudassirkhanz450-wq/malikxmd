// commands/islamic.js - Hadith, Quran Ayat, Prayer Times, Dua
// All free public APIs, no key required. Local fallback included in case an API is down.

const axios = require('axios');

const duaFallback = [
    { title: "Dua for ease", arabic: "اللَّهُمَّ لاَ سَهْلَ إِلاَّ مَا جَعَلْتَهُ سَهْلاً", meaning: "O Allah, nothing is easy except what You make easy." },
    { title: "Dua for forgiveness", arabic: "رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ", meaning: "My Lord, forgive me and accept my repentance." },
    { title: "Dua before eating", arabic: "بِسْمِ اللَّهِ", meaning: "In the name of Allah." },
    { title: "Dua for protection", arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", meaning: "I seek refuge in Allah's perfect words from the evil He created." }
];

const hadithFallback = [
    "The best among you are those who have the best manners and character. (Sahih al-Bukhari)",
    "None of you truly believes until he wishes for his brother what he wishes for himself. (Sahih al-Bukhari)",
    "Whoever believes in Allah and the Last Day should speak good or remain silent. (Sahih al-Bukhari)",
    "The strong person is not the one who can wrestle, but the one who controls himself in anger. (Sahih al-Bukhari)"
];

async function hadithCommand(sock, from, msg) {
    try {
        const res = await axios.get('https://api.hadith.gading.dev/books/bukhari?range=1-300', { timeout: 8000 });
        const list = res.data?.data?.hadiths;
        if (list && list.length) {
            const pick = list[Math.floor(Math.random() * list.length)];
            return await sock.sendMessage(from, { text: `📿 *HADITH — Sahih al-Bukhari #${pick.number}*\n\n${pick.arab ? '' : ''}${pick.id || pick.text || ''}` }, { quoted: msg });
        }
        throw new Error('empty');
    } catch (e) {
        const h = hadithFallback[Math.floor(Math.random() * hadithFallback.length)];
        await sock.sendMessage(from, { text: `📿 *HADITH*\n\n${h}` }, { quoted: msg });
    }
}

async function quoteQuranCommand(sock, from, msg) {
    try {
        const ayahNum = Math.floor(Math.random() * 6236) + 1;
        const res = await axios.get(`https://api.alquran.cloud/v1/ayah/${ayahNum}/en.asad`, { timeout: 8000 });
        const d = res.data?.data;
        if (d) {
            const text = `📖 *QURAN — Surah ${d.surah.englishName} (${d.surah.number}:${d.numberInSurah})*\n\n"${d.text}"`;
            return await sock.sendMessage(from, { text }, { quoted: msg });
        }
        throw new Error('empty');
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Couldn't fetch ayat right now, please try again." }, { quoted: msg });
    }
}

async function prayertimeCommand(sock, from, msg, args) {
    const city = args.join(' ');
    if (!city) return await sock.sendMessage(from, { text: "❌ Usage: .prayertime <city>\nExample: .prayertime Karachi" }, { quoted: msg });
    try {
        const res = await axios.get('https://api.aladhan.com/v1/timingsByCity', {
            params: { city, country: '', method: 2 },
            timeout: 8000
        });
        const t = res.data?.data?.timings;
        if (!t) throw new Error('not found');
        const text =
            `🕌 *PRAYER TIMES — ${city}*\n\n` +
            `🌅 Fajr: ${t.Fajr}\n` +
            `☀️ Dhuhr: ${t.Dhuhr}\n` +
            `🌇 Asr: ${t.Asr}\n` +
            `🌆 Maghrib: ${t.Maghrib}\n` +
            `🌃 Isha: ${t.Isha}`;
        await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ City not found or service unavailable. Try a bigger nearby city name." }, { quoted: msg });
    }
}

async function duaCommand(sock, from, msg) {
    const d = duaFallback[Math.floor(Math.random() * duaFallback.length)];
    await sock.sendMessage(from, { text: `🤲 *${d.title}*\n\n${d.arabic}\n\n_${d.meaning}_` }, { quoted: msg });
}

module.exports = { hadithCommand, quoteQuranCommand, prayertimeCommand, duaCommand };
