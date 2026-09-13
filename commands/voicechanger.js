// commands/voicechanger.js - .vc <type> — 14 free ffmpeg-based voice effects
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const crypto = require('crypto');

ffmpeg.setFfmpegPath(ffmpegStatic);

const FILTERS = {
    robot:      "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)'",
    deep:       "asetrate=44100*0.8,aresample=44100,atempo=1.0",
    bass:       "asetrate=44100*0.8,aresample=44100,atempo=1.0",
    chipmunk:   "asetrate=44100*1.6,aresample=44100",
    high:       "asetrate=44100*1.6,aresample=44100",
    slow:       "atempo=0.75",
    fast:       "atempo=1.5",
    echo:       "aecho=0.8:0.9:1000:0.3",
    reverse:    "areverse",
    nightcore:  "asetrate=44100*1.25,aresample=44100,atempo=1.1",
    demon:      "asetrate=44100*0.6,aresample=44100,aecho=0.8:0.9:40:0.5",
    male:       "asetrate=44100*0.8,aresample=44100,atempo=1.25",
    female:     "asetrate=44100*1.3,aresample=44100,atempo=0.77",
    alien:      "asetrate=44100*1.2,aresample=44100,chorus=0.6:0.9:55:0.4:0.25:2",
    telephone:  "highpass=f=300,lowpass=f=3400",
    underwater: "lowpass=f=500,chorus=0.6:0.9:50:0.4:0.25:2",
    whisper:    "highpass=f=1000,volume=0.6"
};

async function vcCommand(sock, from, msg, args) {
    const type = args[0]?.toLowerCase();
    if (!type || !FILTERS[type]) {
        return await sock.sendMessage(from, {
            text: "🎙️ *VOICE CHANGER*\n\nUsage: reply to a voice note with .vc <type>\n\nAvailable types:\n" + Object.keys(FILTERS).join(', ')
        }, { quoted: msg });
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const audioMsg = quoted?.audioMessage || msg.message?.audioMessage;
    if (!audioMsg) return await sock.sendMessage(from, { text: "❌ Please reply to a voice note / audio message." }, { quoted: msg });

    try {
        await sock.sendMessage(from, { react: { text: '🎙️', key: msg.key } });
        const stream = await downloadContentFromMessage(audioMsg, 'audio');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const tmpDir = path.join(__dirname, '../temp');
        if (!fsSync.existsSync(tmpDir)) await fs.mkdir(tmpDir, { recursive: true });
        const id = crypto.randomBytes(6).toString('hex');
        const inPath = path.join(tmpDir, `${id}_in.ogg`);
        const outPath = path.join(tmpDir, `${id}_out.ogg`);
        await fs.writeFile(inPath, buffer);

        await new Promise((resolve, reject) => {
            ffmpeg(inPath)
                .audioFilters(FILTERS[type])
                .toFormat('ogg')
                .audioCodec('libopus')
                .on('end', resolve)
                .on('error', reject)
                .save(outPath);
        });

        const outBuffer = await fs.readFile(outPath);
        await sock.sendMessage(from, { audio: outBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });

        try { await fs.unlink(inPath); await fs.unlink(outPath); } catch (e) {}
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Voice change failed: " + e.message }, { quoted: msg });
    }
}

module.exports = vcCommand;
