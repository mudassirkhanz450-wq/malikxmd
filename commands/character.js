const { channelInfo } = require('../lib/messageConfig');

// Handles normal messages AND wrapped messages (ephemeral / viewOnce / viewOnceV2 etc.)
function unwrapMessage(msg) {
    let m = msg.message;
    if (!m) return null;

    // Keep unwrapping until we hit a "real" message type
    while (
        m.ephemeralMessage ||
        m.viewOnceMessage ||
        m.viewOnceMessageV2 ||
        m.viewOnceMessageV2Extension ||
        m.documentWithCaptionMessage
    ) {
        m =
            m.ephemeralMessage?.message ||
            m.viewOnceMessage?.message ||
            m.viewOnceMessageV2?.message ||
            m.viewOnceMessageV2Extension?.message ||
            m.documentWithCaptionMessage?.message;
        if (!m) break;
    }
    return m;
}

// Pulls contextInfo no matter which message type it's attached to
// (extendedTextMessage, imageMessage, videoMessage, stickerMessage, etc.)
function getContextInfo(realMsg) {
    if (!realMsg) return null;
    for (const key of Object.keys(realMsg)) {
        const val = realMsg[key];
        if (val && typeof val === 'object' && val.contextInfo) {
            return val.contextInfo;
        }
    }
    return null;
}

async function characterCommand(sock, chatId, message) {
    let userToAnalyze;

    const realMsg = unwrapMessage(message);
    const contextInfo = getContextInfo(realMsg);

    if (contextInfo?.mentionedJid?.length > 0) {
        userToAnalyze = contextInfo.mentionedJid[0];
    } else if (contextInfo?.participant) {
        userToAnalyze = contextInfo.participant;
    }

    if (!userToAnalyze) {
        await sock.sendMessage(chatId, {
            text: 'Please mention someone or reply to their message to analyze their character!',
            ...channelInfo
        });
        return;
    }

    try {
        // Get user's profile picture (safe fallback if none / private)
        let profilePic;
        try {
            profilePic = await sock.profilePictureUrl(userToAnalyze, 'image');
        } catch (picErr) {
            console.log('No profile pic found, using default:', picErr.message);
            profilePic = 'https://i.ibb.co/rGDCPPy/user.png'; // more reliable static fallback
        }

        const traits = [
            "Intelligent", "Creative", "Determined", "Ambitious", "Caring",
            "Charismatic", "Confident", "Empathetic", "Energetic", "Friendly",
            "Generous", "Honest", "Humorous", "Imaginative", "Independent",
            "Intuitive", "Kind", "Logical", "Loyal", "Optimistic",
            "Passionate", "Patient", "Persistent", "Reliable", "Resourceful",
            "Sincere", "Thoughtful", "Understanding", "Versatile", "Wise"
        ];

        const numTraits = Math.floor(Math.random() * 3) + 3; // 3-5
        const selectedTraits = [];
        while (selectedTraits.length < numTraits) {
            const randomTrait = traits[Math.floor(Math.random() * traits.length)];
            if (!selectedTraits.includes(randomTrait)) {
                selectedTraits.push(randomTrait);
            }
        }

        const traitPercentages = selectedTraits.map(trait => {
            const percentage = Math.floor(Math.random() * 41) + 60; // 60-100
            return `${trait}: ${percentage}%`;
        });

        const analysis = `╭══✦〔🔮 *Character Analysis* 🔮〕✦═╮\n│ \n` +
            `│ 👤 *User:* @${userToAnalyze.split('@')[0]}\n│ \n` +
            `│ ✨ *Key Traits:*\n│ ${traitPercentages.join('\n│ ')}\n│ \n` +
            `│ 🎯 *Overall Rating:* ${Math.floor(Math.random() * 21) + 80}%\n│ \n` +
            `│ Note: This is a fun analysis and should not be taken seriously!\n│ \n` +
            `╰═✦═✦═✦═✦═✦═✦═✦═✦═✦═╯`;

        try {
            await sock.sendMessage(chatId, {
                image: { url: profilePic },
                caption: analysis,
                mentions: [userToAnalyze],
                ...channelInfo
            });
        } catch (imgErr) {
            // If image send fails (bad url / network), still deliver the analysis as text
            console.error('Image send failed, falling back to text:', imgErr.message);
            await sock.sendMessage(chatId, {
                text: analysis,
                mentions: [userToAnalyze],
                ...channelInfo
            });
        }
    } catch (error) {
        console.error('Error in character command:', error); // full error, not just message
        await sock.sendMessage(chatId, {
            text: `Failed to analyze character! Try again later.\n\n_Debug: ${error.message || error}_`,
            ...channelInfo
        });
    }
}

module.exports = characterCommand;