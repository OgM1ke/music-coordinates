// Telegram WebApp инициализация
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ===== КОНФИГ =====
const CONFIG = {
    CHANNEL_ID: '@MemeCords',
    CHANNEL_URL: 'https://t.me/MemeCords',
    BOT_USERNAME: '@memecordsbot',
    TOTAL_QUESTIONS: 30
};

// ===== DOM =====
const modal = document.getElementById('subscribe-modal');
const modalClose = document.getElementById('modal-close');
const subscribeBtn = document.getElementById('subscribe-btn');
const checkSubBtn = document.getElementById('check-sub-btn');
const startBtn = document.getElementById('start-btn');

// Состояние приложения
const state = {
    currentScreen: 'start',
    currentQuestion: 0,
    answers: [],
    isSubscribed: false,
    testCompleted: false,
    testStarted: false, // Флаг что тест уже начат (вопросы показаны)
    result: null,
    subscriptionChecked: false
};

// Вопросы
let questions = [];

// DOM элементы экранов
const screens = {
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen'),
    friends: document.getElementById('friends-screen')
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function init() {
    await loadQuestions();
    await checkSubscriptionStatus();
    setupEventListeners();
    setupTelegramTheme();
    
    // Показываем стартовый экран
    switchScreen('start');
}

// Загрузка вопросов
async function loadQuestions() {
    try {
        const response = await fetch('/api/questions');
        questions = await response.json();
    } catch (e) {
        questions = generateTestQuestions();
    }
}

function generateTestQuestions() {
    return Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        text: `Вопрос ${i + 1}: ${getQuestionText(i)}`,
        meme: i % 3 === 0 ? `meme_${i}.jpg` : null,
        options: [
            { text: 'Полностью согласен', value: 2 },
            { text: 'Скорее согласен', value: 1 },
            { text: 'По-разному', value: 0 },
            { text: 'Скорее не согласен', value: -1 },
            { text: 'Полностью не согласен', value: -2 }
        ]
    }));
}

function getQuestionText(index) {
    const texts = [
        'Андеграунд-сцена важнее для культуры, чем все топ-50 артистов мира вместе взятые.',
        'Фейковые фритюки с блогером портят впечатление о музыке.',
        'Коллаборации между андеграунд и поп-артистами — это всегда компромисс и предательство принципов.',
        'Музыка должна развлекать, а не заставлять думать о проблемах мира.',
        'Виниловые пластинки звучат лучше цифровых форматов.',
        'Автотюн — это инструмент, а не убийца музыкальности.',
        'Концерты в маленьких клубах круче стадионных шоу.',
        'Музыкальные фестивали перестали быть про музыку.'
    ];
    return texts[index % texts.length];
}

// ===== ПРОВЕРКА ПОДПИСКИ =====

// Проверка через Telegram Bot API (рекомендуется)
// Бот должен быть админом в канале с правами на чтение подписчиков
async function checkSubscriptionViaBot(userId) {
    const BOT_TOKEN = 'YOUR_BOT_TOKEN'; // Замени на токен бота
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.CHANNEL_ID,
                user_id: userId
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            const status = data.result.status;
            // Пользователь подписан если: member, administrator, creator
            return ['member', 'administrator', 'creator'].includes(status);
        }
        return false;
    } catch (e) {
        console.error('Bot API error:', e);
        return false;
    }
}

async function checkSubscriptionStatus() {
    if (state.subscriptionChecked && state.isSubscribed) return true;
    
    const userId = tg.initDataUnsafe?.user?.id;
    
    // Пробуем проверить через бота
    if (userId) {
        const isSubscribed = await checkSubscriptionViaBot(userId);
        state.isSubscribed = isSubscribed;
        state.subscriptionChecked = true;
        
        if (isSubscribed) {
            localStorage.setItem('subscribed', 'true');
            localStorage.setItem('subscribed_user_id', userId);
        }
        
        return isSubscribed;
    }
    
    // Fallback на localStorage
    const savedSub = localStorage.getItem('subscribed');
    const savedUserId = localStorage.getItem('subscribed_user_id');
    
    if (savedSub === 'true' && savedUserId == userId) {
        state.isSubscribed = true;
        state.subscriptionChecked = true;
        return true;
    }
    
    state.subscriptionChecked = true;
    return false;
}

async function checkSubscription() {
    state.subscriptionChecked = false;
    return await checkSubscriptionStatus();
}

// ===== ОБРАБОТЧИКИ =====

function setupEventListeners() {
    // Кнопка "Начать" на стартовом экране
    startBtn?.addEventListener('click', async () => {
        await checkSubscriptionStatus();
        
        if (!state.isSubscribed) {
            modal.classList.remove('hidden');
        } else {
            startQuiz();
        }
    });

    // Закрыть модалку
    modalClose?.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.add('hidden');
    });

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Подписаться — открыть канал
    subscribeBtn?.addEventListener('click', () => {
        tg.openTelegramLink(CONFIG.CHANNEL_URL);
        startAutoCheck();
    });

    // Проверить подписку
    checkSubBtn?.addEventListener('click', async () => {
        checkSubBtn.textContent = 'Проверяем...';
        checkSubBtn.disabled = true;
        
        const isSubscribed = await checkSubscription();
        
        if (isSubscribed) {
            modal.classList.add('hidden');
            resetCheckButton();
            startQuiz();
        } else {
            checkSubBtn.textContent = 'Не подписаны';
            setTimeout(() => {
                resetCheckButton();
            }, 2000);
        }
    });

    // Навигация
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            
            const screen = btn.dataset.screen;
            handleNavigation(screen, btn);
        });
    });
}

function handleNavigation(screen, btnElement) {
    // Обновляем активную вкладку
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    
    if (screen === 'quiz' || screen === 'test') {
        // При переходе на "Тест" показываем либо старт, либо вопросы
        if (state.testStarted) {
            // Тест уже начат — показываем вопросы
            switchScreen('quiz');
        } else {
            // Тест не начат — показываем стартовый экран
            switchScreen('start');
        }
    } else if (screen === 'result') {
        if (!state.testCompleted) return; // Недоступно
        switchScreen('result');
    } else if (screen === 'friends' || screen === 'share') {
        switchScreen('friends');
    } else if (screen === 'share-action') {
        // Кнопка "Поделиться"
        handleShare();
    } else {
        switchScreen(screen);
    }
}

function handleShare() {
    const text = state.result 
        ? `Мой архетип: ${state.result.archetype}. Бро, а где ты на координатах?`
        : 'Пройди тест и узнай свои музыкальные координаты!';
    
    const url = `https://t.me/${CONFIG.BOT_USERNAME}?start=app`;
    
    // Открываем нативный шеринг Telegram
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
}

// Автопроверка подписки
let autoCheckInterval = null;

function startAutoCheck() {
    if (autoCheckInterval) clearInterval(autoCheckInterval);
    
    autoCheckInterval = setInterval(async () => {
        if (modal.classList.contains('hidden')) {
            clearInterval(autoCheckInterval);
            autoCheckInterval = null;
            return;
        }
        
        const isSubscribed = await checkSubscription();
        
        if (isSubscribed) {
            clearInterval(autoCheckInterval);
            autoCheckInterval = null;
            modal.classList.add('hidden');
            resetCheckButton();
            startQuiz();
        }
    }, 3000);
    
    setTimeout(() => {
        if (autoCheckInterval) {
            clearInterval(autoCheckInterval);
            autoCheckInterval = null;
        }
    }, 60000);
}

function resetCheckButton() {
    checkSubBtn.textContent = 'Проверить подписку';
    checkSubBtn.disabled = false;
}

function startQuiz() {
    state.testStarted = true;
    state.currentQuestion = 0;
    state.answers = [];
    
    switchScreen('quiz');
    showQuestion(0);
}

function showQuestion(index) {
    const question = questions[index];
    
    const progressFill = document.querySelector('.progress-fill');
    const questionCounter = document.querySelector('.question-counter');
    
    if (progressFill) {
        progressFill.style.width = `${((index + 1) / questions.length) * 100}%`;
    }
    if (questionCounter) {
        questionCounter.textContent = `${index + 1} / ${questions.length}`;
    }
    
    const memeContainer = document.getElementById('meme-image');
    if (memeContainer) {
        if (question.meme) {
            memeContainer.innerHTML = `<img src="/memes/${question.meme}" alt="meme">`;
            memeContainer.classList.remove('empty');
        } else {
            memeContainer.innerHTML = '';
            memeContainer.classList.add('empty');
        }
    }
    
    const questionText = document.getElementById('question-text');
    if (questionText) {
        questionText.textContent = question.text;
    }
    
    const container = document.getElementById('answers-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    question.options.forEach((option, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.innerHTML = `<span class="answer-text">${option.text}</span>`;
        
        btn.addEventListener('mouseenter', () => btn.classList.add('hovered'));
        btn.addEventListener('mouseleave', () => btn.classList.remove('hovered'));
        btn.addEventListener('click', () => selectAnswer(index, i, option.value, btn));
        
        container.appendChild(btn);
    });
}

function selectAnswer(questionIndex, optionIndex, value, btnElement) {
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected', 'hovered');
    });
    
    btnElement.classList.add('selected');
    
    state.answers[questionIndex] = {
        questionId: questions[questionIndex].id,
        value: value
    };
    
    setTimeout(() => {
        if (questionIndex < questions.length - 1) {
            state.currentQuestion++;
            showQuestion(state.currentQuestion);
        } else {
            finishTest();
        }
    }, 300);
}

function finishTest() {
    state.testCompleted = true;
    
    const score = calculateScore();
    state.result = score;
    
    saveResult(score);
    showResult(score);
}

function calculateScore() {
    const total = state.answers.reduce((sum, a) => sum + Math.abs(a.value), 0);
    const max = questions.length * 2;
    const percentage = (total / max) * 100;
    
    let archetype, description;
    
    if (percentage <= 2) {
        archetype = 'ГЕНИЙ';
        description = 'Ты видишь музыку там, где другие слышат шум. Твой вкус формирует будущее.';
    } else if (percentage <= 5) {
        archetype = 'МАСТЕР';
        description = 'Глубокое понимание музыки и культуры. Ты знаешь, что хорошо, и почему.';
    } else if (percentage <= 20) {
        archetype = 'НОРМИС';
        description = 'Сбалансированный вкус. Ты цениши качественную музыку, но не фанатичен.';
    } else if (percentage <= 80) {
        archetype = 'ПОДПИСЧИК';
        description = 'Ты следуешь за трендами и доверяешь чужому мнению чаще, чем своему.';
    } else {
        archetype = 'НУБАС';
        description = 'Музыка для тебя — фон. Но это тоже путь, главное — начать слушать внимательнее.';
    }
    
    return {
        percentage: percentage.toFixed(1),
        archetype,
        description,
        coordinates: {
            x: Math.random() * 100,
            y: Math.random() * 100
        }
    };
}

function showResult(result) {
    switchScreen('result');
    
    const archetypeName = document.getElementById('archetype-name');
    const archetypeDesc = document.getElementById('archetype-desc');
    const resultPercentage = document.getElementById('result-percentage');
    
    if (archetypeName) archetypeName.textContent = result.archetype;
    if (archetypeDesc) archetypeDesc.textContent = result.description;
    if (resultPercentage) resultPercentage.textContent = `${result.percentage}%`;
    
    setTimeout(() => {
        const point = document.getElementById('result-point');
        if (point) {
            point.style.left = `${result.coordinates.x}%`;
            point.style.top = `${result.coordinates.y}%`;
        }
    }, 100);
    
    drawChart();
}

function drawChart() {
    const canvas = document.getElementById('result-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = 280;
    canvas.width = size;
    canvas.height = size;
    
    const center = size / 2;
    
    ctx.clearRect(0, 0, size, size);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(center, 20);
    ctx.lineTo(center, size - 20);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(20, center);
    ctx.lineTo(size - 20, center);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px SF Pro Display';
    ctx.textAlign = 'center';
    
    ctx.fillText('ЭЛИТАРНОЕ', center, 15);
    ctx.fillText('МАССОВОЕ', center, size - 5);
    ctx.fillText('АНДЕРГРАУНД', 35, center + 4);
    ctx.fillText('МЕЙНСТРИМ', size - 35, center + 4);
}

async function saveResult(result) {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;
    
    try {
        await fetch('/api/save-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                result,
                answers: state.answers
            })
        });
    } catch (e) {
        console.error('Failed to save result:', e);
    }
}

function switchScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
    state.currentScreen = screenName;
}

function setupTelegramTheme() {
    if (tg.colorScheme === 'light') {
        document.documentElement.style.setProperty('--bg-primary', '#ffffff');
        document.documentElement.style.setProperty('--bg-secondary', '#f2f2f7');
        document.documentElement.style.setProperty('--text-primary', '#000000');
    }
}

// Запуск
init();
