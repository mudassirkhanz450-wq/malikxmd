// Simple in-memory store mapping chatId -> current temp email
// NOTE: resets if the bot restarts. Good enough for casual use.
const store = new Map();

function setEmail(chatId, email) {
    store.set(chatId, email);
}

function getEmail(chatId) {
    return store.get(chatId) || null;
}

function clearEmail(chatId) {
    return store.delete(chatId);
}

function clearAll() {
    const count = store.size;
    store.clear();
    return count;
}

module.exports = { setEmail, getEmail, clearEmail, clearAll };
