// server.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== НАСТРОЙКИ =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID || '@MemeCords';
const PORT = process.env.PORT || 3000;  // Render даёт PORT автоматически

if (!BOT_TOKEN) {
    console.error('❌ Укажи BOT_TOKEN!');
    process.exit(1);
}

// ===== БАЗА ДАННЫХ (Render позволяет писать в /tmp) =====
const DB_PATH = process.env.RENDER 
    ? '/tmp/results.db'  // На Render пишем в /tmp
    : './database/results.db';

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Ошибка БД:', err);
    else console.log('✅ БД подключена:', DB_PATH);
});

db.run(`
    CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        username TEXT,
        first_name TEXT,
        archetype TEXT,
        percentage REAL,
        coordinates_x REAL,
        coordinates_y REAL,
        answers TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// ===== BOT =====
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: true,
    webHook: false  // На Render polling работает нормально
});

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    db.run(
        `INSERT OR REPLACE INTO results (user_id, username, first_name) 
         VALUES (?, ?, ?)`,
        [user.id, user.username, user.first_name]
    );
    
    // Получаем URL сервера (Render даёт автоматически)
    const appUrl = process.env.RENDER_EXTERNAL_URL 
        || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`
        || 'http://localhost:3000';
    
    await bot.sendMessage(chatId, 
        `🎵 *Музыкальные Координаты*\n\nУзнай свою тёмную сторону!`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🎧 Начать тест', web_app: { url: appUrl } }
                ], [
                    { text: '📢 Канал Warhol', url: `https://t.me/${CHANNEL_ID.replace('@', '')}` }
                ]]
            }
        }
    );
});

// ===== API =====

app.get('/api/check-subscription', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    
    try {
        const member = await bot.getChatMember(CHANNEL_ID, parseInt(userId));
        const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
        res.json({ subscribed: isSubscribed });
    } catch (error) {
        res.json({ subscribed: false });
    }
});

app.get('/api/questions', (req, res) => {
    try {
        const questions = require('./questions.json');
        const shuffled = questions.sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 30));
    } catch (error) {
        res.status(500).json({ error: 'Questions not found' });
    }
});

app.post('/api/save-result', (req, res) => {
    const { userId, archetype, percentage, coordinates, answers } = req.body;
    
    db.run(
        `UPDATE results SET 
            archetype = ?, percentage = ?, 
            coordinates_x = ?, coordinates_y = ?, answers = ?
         WHERE user_id = ?`,
        [archetype, percentage, coordinates?.x || 50, coordinates?.y || 50, 
         JSON.stringify(answers), userId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.get('/api/result/:userId', (req, res) => {
    db.get(
        `SELECT * FROM results WHERE user_id = ?`,
        [req.params.userId],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Not found' });
            res.json({
                archetype: row.archetype,
                percentage: row.percentage,
                coordinates: { x: row.coordinates_x, y: row.coordinates_y }
            });
        }
    );
});

// Health check для Render
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Environment: ${process.env.RENDER ? 'Render' : 'Local'}`);
});
