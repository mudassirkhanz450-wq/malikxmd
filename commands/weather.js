const fetch = require('node-fetch');
const settings = require('../settings');

async function weatherCommand(sock, chatId, msg) {
    // Extract the full text of the command message ourselves,
    // since the dispatcher only passes (sock, from, msg).
    const fullText = msg.message?.conversation?.trim() ||
                     msg.message?.extendedTextMessage?.text?.trim() || '';

    // Remove the command word itself (".weather") and keep the rest as the city name
    const q = fullText.split(' ').slice(1).join(' ').trim();

    if (!q) {
        await sock.sendMessage(chatId, {
            text: '🌦️ *Usage:* .weather <city name>\n\nExample:\n.weather Lahore'
        }, { quoted: msg });
        return;
    }

    try {
        const city = q.trim();
        const apiKey = settings.openWeatherApiKey;

        if (!apiKey || apiKey === 'YOUR_OPENWEATHER_API_KEY') {
            await sock.sendMessage(chatId, {
                text: '❌ Weather API key set nahi hai. settings.js mein `openWeatherApiKey` add karein.'
            }, { quoted: msg });
            return;
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.cod !== 200) {
            await sock.sendMessage(chatId, {
                text: `❌ City nahi mila: "${city}"\n\n_Debug: ${data.message || 'unknown error'}_`
            }, { quoted: msg });
            return;
        }

        const emojiMap = {
            Clear: '☀️',
            Clouds: '☁️',
            Rain: '🌧️',
            Drizzle: '🌦️',
            Thunderstorm: '⛈️',
            Snow: '❄️',
            Mist: '🌫️',
            Smoke: '🌫️',
            Haze: '🌫️',
            Dust: '🌫️',
            Fog: '🌫️',
            Sand: '🌫️',
            Ash: '🌫️',
            Squall: '💨',
            Tornado: '🌪️'
        };

        const condition = data.weather?.[0]?.main || 'N/A';
        const description = data.weather?.[0]?.description || 'N/A';
        const emoji = emojiMap[condition] || '🌡️';

        const text =
            `${emoji} *Weather in ${data.name}, ${data.sys?.country || ''}*\n\n` +
            `🌡️ *Temperature:* ${data.main.temp}°C\n` +
            `🥵 *Feels like:* ${data.main.feels_like}°C\n` +
            `📉 *Min / Max:* ${data.main.temp_min}°C / ${data.main.temp_max}°C\n` +
            `💧 *Humidity:* ${data.main.humidity}%\n` +
            `💨 *Wind:* ${data.wind?.speed ?? 'N/A'} m/s\n` +
            `☁️ *Condition:* ${description}\n` +
            `🔽 *Pressure:* ${data.main.pressure} hPa`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (error) {
        console.error('Error in weather command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to get weather info.\n\n_Debug: ${error.message || error}_`
        }, { quoted: msg });
    }
}

module.exports = weatherCommand;
