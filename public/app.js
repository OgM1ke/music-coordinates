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
    result: null,
    subscriptionChecked: false // Флаг что проверка уже выполнялась
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
    
    // Проверяем подписку при старте (чтобы не показывать модалку если уже подписан)
    await checkSubscriptionStatus();
    
    // Навешиваем обработчики
    setupEventListeners();
    
    // Настраиваем тему Telegram
    setupTelegramTheme();
    
    // Если уже подписан, обновляем UI
    if (state.isSubscribed) {
        console.log('User already subscribed');
    }
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
async function checkSubscriptionStatus() {
    // Если уже проверяли и подписаны — не проверяем снова
    if (state.subscriptionChecked && state.isSubscribed) {
        return true;
    }
    
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
        // Пробуем localStorage как fallback
        const savedSub = localStorage.getItem('subscribed');
        if (savedSub === 'true') {
            state.isSubscribed = true;
            state.subscriptionChecked = true;
        }
        return state.isSubscribed;
    }
    
    try {
        const response = await fetch(`/api/check-subscription?userId=${userId}`);
        const data = await response.json();
        
        state.isSubscribed = data.subscribed;
        state.subscriptionChecked = true;
        
        // Сохраняем в localStorage для персистентности
        if (data.subscribed) {
            localStorage.setItem('subscribed', 'true');
            localStorage.setItem('subscribed_user_id', userId);
        }
        
        return data.subscribed;
    } catch (e) {
        console.error('Failed to check subscription:', e);
        // Fallback: проверяем localStorage
        const savedSub = localStorage.getItem('subscribed');
        const savedUserId = localStorage.getItem('subscribed_user_id');
        
        if (savedSub === 'true' && savedUserId == userId) {
            state.isSubscribed = true;
        }
        
        state.subscriptionChecked = true;
        return state.isSubscribed;
    }
}

// Функция для ручной проверки (по кнопке)
async function checkSubscription() {
    // Сбрасываем флаг чтобы принудительно перепроверить
    state.subscriptionChecked = false;
    return await checkSubscriptionStatus();
}

// ===== ОБРАБОТЧИКИ =====

function setupEventListeners() {
    // Открыть модалку или начать тест
    startBtn?.addEventListener('click', async () => {
        // Проверяем подписку ещё раз перед показом модалки
        await checkSubscriptionStatus();
        
        if (!state.isSubscribed) {
            // Не подписан — показываем модалку
            modal.classList.remove('hidden');
        } else {
            // Уже подписан — сразу начинаем тест
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
        
        // Запускаем периодическую проверку подписки
        // (на случай если пользователь подпишется в другом окне)
        startAutoCheck();
    });

    // Проверить подписку вручную
    checkSubBtn?.addEventListener('click', async () => {
        checkSubBtn.textContent = 'Проверяем...';
        checkSubBtn.disabled = true;
        
        const isSubscribed = await checkSubscription();
        
        if (isSubscribed) {
            // Подписан — закрываем модалку и начинаем тест
            modal.classList.add('hidden');
            resetCheckButton();
            startQuiz();
        } else {
            // Не подписан — показываем ошибку
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
            
            if (screen === 'result' && !state.testCompleted) {
                return; // Недоступно
            }
            
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            switchScreen(screen);
        });
    });
}

// Автоматическая проверка подписки (пока модалка открыта)
let autoCheckInterval = null;

function startAutoCheck() {
    // Очищаем предыдущий интервал если есть
    if (autoCheckInterval) {
        clearInterval(autoCheckInterval);
    }
    
    // Проверяем каждые 3 секунды
    autoCheckInterval = setInterval(async () => {
        // Проверяем только если модалка открыта
        if (modal.classList.contains('hidden')) {
            clearInterval(autoCheckInterval);
            autoCheckInterval = null;
            return;
        }
        
        const isSubscribed = await checkSubscription();
        
        if (isSubscribed) {
            // Подписан — закрываем модалку и начинаем тест
            clearInterval(autoCheckInterval);
            autoCheckInterval = null;
            modal.classList.add('hidden');
            resetCheckButton();
            startQuiz();
        }
    }, 3000);
    
    // Останавливаем проверку через 60 секунд (чтобы не грузить сервер)
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
    state.currentQuestion = 0;
    state.answers = [];
    state.testCompleted = false;
    
    switchScreen('quiz');
    showQuestion(0);
}

function showQuestion(index) {
    const question = questions[index];
    
    // Обновляем прогресс
    const progressFill = document.querySelector('.progress-fill');
    const questionCounter = document.querySelector('.question-counter');
    
    if (progressFill) {
        progressFill.style.width = `${((index + 1) / questions.length) * 100}%`;
    }
    if (questionCounter) {
        questionCounter.textContent = `${index + 1} / ${questions.length}`;
    }
    
    // Мем
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
    
    // Текст вопроса
    const questionText = document.getElementById('question-text');
    if (questionText) {
        questionText.textContent = question.text;
    }
    
    // Варианты ответов
    const container = document.getElementById('answers-container');
    if (!container) return;
    
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
    
    const archetypeName = document.getElementById('archetype-name');
    const archetypeDesc = document.getElementById('archetype-desc');
    const resultPercentage = document.getElementById('result-percentage');
    
    if (archetypeName) archetypeName.textContent = result.archetype;
    if (archetypeDesc) archetypeDesc.textContent = result.description;
    if (resultPercentage) resultPercentage.textContent = `${result.percentage}%`;
    
    // Анимация точки на графике
    setTimeout(() => {
        const point = document.getElementById('result-point');
        if (point) {
            point.style.left = `${result.coordinates.x}%`;
            point.style.top = `${result.coordinates.y}%`;
        }
    }, 100);
    
    // Рисуем график
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
    
    // Очищаем canvas
    ctx.clearRect(0, 0, size, size);
    
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
