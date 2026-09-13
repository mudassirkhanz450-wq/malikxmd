// commands/media-local.js - QR Generator, Calligraphy, Compress (all local, no API key)
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const crypto = require('crypto');
let QRCode;
try { QRCode = require('qrcode'); } catch (e) { QRCode = null; }

ffmpeg.setFfmpegPath(ffmpegStatic);

// ---------- QR CODE ----------
async function qrCommand(sock, from, msg, args) {
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: "❌ Usage: .qr <text or link>" }, { quoted: msg });
    if (!QRCode) return await sock.sendMessage(from, { text: "❌ QR module not installed. Run: npm install qrcode" }, { quoted: msg });
    try {
        const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2 });
        await sock.sendMessage(from, { image: buffer, caption: `✅ QR Code for: ${text}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to generate QR: " + e.message }, { quoted: msg });
    }
}

// ---------- CALLIGRAPHY (text -> styled image) ----------
async function calligraphyCommand(sock, from, msg, args) {
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: "❌ Usage: .calligraphy <text>" }, { quoted: msg });
    try {
        const width = 900, height = 400;
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const fontSize = text.length > 20 ? 48 : 72;
        const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1a1a2e"/>
                    <stop offset="100%" stop-color="#16213e"/>
                </linearGradient>
                <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#f5d576"/>
                    <stop offset="100%" stop-color="#e0a800"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg)"/>
            <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="url(#gold)" stroke-width="3"/>
            <text x="50%" y="50%" font-family="Georgia, 'Noto Nastaliq Urdu', serif" font-size="${fontSize}" fill="url(#gold)" text-anchor="middle" dominant-baseline="middle">${escaped}</text>
        </svg>`;
        const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
        await sock.sendMessage(from, { image: buffer, caption: "✨ Calligraphy" }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to generate calligraphy: " + e.message }, { quoted: msg });
    }
}

// ---------- COMPRESS ----------
async function compressCommand(sock, from, msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    const vType = quoted?.imageMessage ? 'imageMessage' : quoted?.videoMessage ? 'videoMessage' : null;
    if (!vType) return await sock.sendMessage(from, { text: "❌ Reply to an image or video with .compress" }, { quoted: msg });

    try {
        const stream = await downloadContentFromMessage(quoted[vType], vType.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        if (vType === 'imageMessage') {
            const out = await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 50 }).toBuffer();
            await sock.sendMessage(from, { image: out, caption: `✅ Compressed: ${(buffer.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB` }, { quoted: msg });
        } else {
            const tmpDir = path.join(__dirname, '../temp');
            if (!fsSync.existsSync(tmpDir)) await fs.mkdir(tmpDir, { recursive: true });
            const id = crypto.randomBytes(6).toString('hex');
            const inPath = path.join(tmpDir, `${id}_in.mp4`);
            const outPath = path.join(tmpDir, `${id}_out.mp4`);
            await fs.writeFile(inPath, buffer);
            await new Promise((resolve, reject) => {
                ffmpeg(inPath)
                    .videoBitrate('500k')
                    .size('640x?')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outPath);
            });
            const out = await fs.readFile(outPath);
            await sock.sendMessage(from, { video: out, caption: `✅ Compressed: ${(buffer.length / 1024 / 1024).toFixed(1)}MB → ${(out.length / 1024 / 1024).toFixed(1)}MB` }, { quoted: msg });
            try { await fs.unlink(inPath); await fs.unlink(outPath); } catch (e) {}
        }
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Compression failed: " + e.message }, { quoted: msg });
    }
}

module.exports = { qrCommand, calligraphyCommand, compressCommand };
