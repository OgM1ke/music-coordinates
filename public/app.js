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
    result: null
};

// Вопросы (пример структуры, загружается с сервера)
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
    // Загружаем вопросы
    await loadQuestions();
    
    // Проверяем подписку (из localStorage или API)
    checkSubscriptionStatus();
    
    // Навешиваем обработчики
    setupEventListeners();
    
    // Настраиваем тему Telegram
    setupTelegramTheme();
}

// Загрузка вопросов
async function loadQuestions() {
    try {
        // В реальном приложении загружаем с сервера
        const response = await fetch('/api/questions');
        questions = await response.json();
    } catch (e) {
        // Fallback: тестовые данные
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
async function checkSubscriptionStatus() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;
    
    try {
        const response = await fetch(`/api/check-subscription?userId=${userId}`);
        const data = await response.json();
        state.isSubscribed = data.subscribed;
    } catch (e) {
        // Fallback: проверяем localStorage
        state.isSubscribed = localStorage.getItem('subscribed') === 'true';
    }
}

async function checkSubscription() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return false;
    
    try {
        const res = await fetch(`/api/check-subscription?userId=${userId}`);
        const data = await res.json();
        return data.subscribed;
    } catch (e) {
        return false;
    }
}

// ===== ОБРАБОТЧИКИ =====

function setupEventListeners() {
    // Открыть модалку
    startBtn?.addEventListener('click', () => {
        if (!state.isSubscribed) {
            modal.classList.remove('hidden');
        } else {
            startQuiz();
        }
    });

    // Закрыть по кнопке ✕
    modalClose?.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.add('hidden');
    });

    // Закрыть по клику вне (на фон)
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Подписаться — открыть канал
    subscribeBtn?.addEventListener('click', () => {
        tg.openTelegramLink(CONFIG.CHANNEL_URL);
    });

    // Проверить подписку
    checkSubBtn?.addEventListener('click', async () => {
        checkSubBtn.textContent = 'Проверяем...';
        checkSubBtn.disabled = true;
        
        const isSubscribed = await checkSubscription();
        
        if (isSubscribed) {
            state.isSubscribed = true;
            localStorage.setItem('subscribed', 'true');
            modal.classList.add('hidden');
            startQuiz();
        } else {
            checkSubBtn.textContent = 'Не подписаны';
            setTimeout(() => {
                checkSubBtn.textContent = 'Проверить подписку';
                checkSubBtn.disabled = false;
            }, 2000);
        }
    });

    // Навигация
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            
            const screen = btn.dataset.screen;
            
            if (screen === 'result' && !state.testCompleted) {
                return; // Недоступно
            }
            
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            switchScreen(screen);
        });
    });
}

function startQuiz() {
    state.currentQuestion = 0;
    state.answers = [];
    state.testCompleted = false;
    
    switchScreen('quiz');
    showQuestion(0);
}

function showQuestion(index) {
    const question = questions[index];
    
    // Обновляем прогресс
    document.querySelector('.progress-fill').style.width = `${(index / questions.length) * 100}%`;
    document.querySelector('.question-counter').textContent = `${index + 1} / ${questions.length}`;
    
    // Мем
    const memeContainer = document.getElementById('meme-image');
    if (question.meme) {
        memeContainer.innerHTML = `<img src="/memes/${question.meme}" alt="meme">`;
        memeContainer.classList.remove('empty');
    } else {
        memeContainer.innerHTML = '';
        memeContainer.classList.add('empty');
    }
    
    // Текст вопроса
    document.getElementById('question-text').textContent = question.text;
    
    // Варианты ответов
    const container = document.getElementById('answers-container');
    container.innerHTML = '';
    
    question.options.forEach((option, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.innerHTML = `<span class="answer-text">${option.text}</span>`;
        
        // Hover эффект
        btn.addEventListener('mouseenter', () => btn.classList.add('hovered'));
        btn.addEventListener('mouseleave', () => btn.classList.remove('hovered'));
        
        // Выбор
        btn.addEventListener('click', () => selectAnswer(index, i, option.value, btn));
        
        container.appendChild(btn);
    });
}

function selectAnswer(questionIndex, optionIndex, value, btnElement) {
    // Убираем выделение с других
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected', 'hovered');
    });
    
    // Выделяем текущий
    btnElement.classList.add('selected');
    
    // Сохраняем ответ
    state.answers[questionIndex] = {
        questionId: questions[questionIndex].id,
        value: value
    };
    
    // Задержка перед следующим вопросом
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
    
    // Рассчитываем результат
    const score = calculateScore();
    state.result = score;
    
    // Сохраняем на сервере
    saveResult(score);
    
    // Показываем результат
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
    
    document.getElementById('archetype-name').textContent = result.archetype;
    document.getElementById('archetype-desc').textContent = result.description;
    document.getElementById('result-percentage').textContent = `${result.percentage}%`;
    
    // Анимация точки на графике
    setTimeout(() => {
        const point = document.getElementById('result-point');
        point.style.left = `${result.coordinates.x}%`;
        point.style.top = `${result.coordinates.y}%`;
    }, 100);
    
    // Рисуем график
    drawChart();
}

function drawChart() {
    const canvas = document.getElementById('result-chart');
    const ctx = canvas.getContext('2d');
    const size = 280;
    canvas.width = size;
    canvas.height = size;
    
    const center = size / 2;
    
    // Оси
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    
    // Вертикальная
    ctx.beginPath();
    ctx.moveTo(center, 20);
    ctx.lineTo(center, size - 20);
    ctx.stroke();
    
    // Горизонтальная
    ctx.beginPath();
    ctx.moveTo(20, center);
    ctx.lineTo(size - 20, center);
    ctx.stroke();
    
    // Подписи осей
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

// ===== НАВИГАЦИЯ =====
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
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
