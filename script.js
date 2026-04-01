// ========== 🚀 ОФЛАЙН-СИНХРОНИЗАЦИЯ (ДОБАВЛЕНО) ==========
// =======================================================
// ========== ДОПОЛНИТЕЛЬНЫЕ УЛУЧШЕНИЯ ==========

// Сохранение прогресса чтения (позиция страницы)
function saveReadingProgress(bookId, page) {
    try {
        const progress = JSON.parse(localStorage.getItem('readingProgress') || '{}');
        progress[bookId] = page;
        localStorage.setItem('readingProgress', JSON.stringify(progress));
    } catch (e) {
        console.warn('Не удалось сохранить прогресс');
    }
}

// Восстановление прогресса чтения
function getReadingProgress(bookId) {
    try {
        const progress = JSON.parse(localStorage.getItem('readingProgress') || '{}');
        return progress[bookId] || 1;
    } catch (e) {
        return 1;
    }
}

// Модифицируем openBook для восстановления прогресса
const originalOpenBook = window.openBook;
window.openBook = function(bookId) {
    const savedPage = getReadingProgress(bookId);
    originalOpenBook(bookId);
    
    if (savedPage > 1 && currentBook && currentBook.id === bookId) {
        currentPage = savedPage;
        updateReaderContent();
    }
};

// Сохраняем прогресс при закрытии или смене страницы
function saveCurrentProgress() {
    if (currentBook && currentBook.id) {
        saveReadingProgress(currentBook.id, currentPage);
    }
}

// Перехватываем закрытие читалки
const originalCloseReader = window.closeReader;
window.closeReader = function() {
    saveCurrentProgress();
    originalCloseReader();
};

// Сохраняем при смене страницы
const originalUpdateReaderContent = updateReaderContent;
updateReaderContent = function() {
    originalUpdateReaderContent();
    if (currentBook && currentBook.id) {
        saveReadingProgress(currentBook.id, currentPage);
    }
};

// Проверка наличия обновлений приложения
if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}

// Отображение размера кэша (для отладки)
async function showCacheSize() {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        let totalSize = 0;
        for (const name of cacheNames) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            console.log(`Кэш "${name}": ${keys.length} файлов`);
        }
    }
}

// Вызываем при загрузке (опционально)
if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
    showCacheSize();
}

let offlineReady = false;

// Отображение статуса подключения (визуальный индикатор)
function updateConnectionStatus() {
  let statusDiv = document.getElementById('connection-status');
  
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'connection-status';
    statusDiv.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-family: sans-serif;
      z-index: 1000;
      background: rgba(0,0,0,0.7);
      color: white;
      backdrop-filter: blur(4px);
      pointer-events: none;
    `;
    document.body.appendChild(statusDiv);
  }
  
  if (navigator.onLine) {
    statusDiv.textContent = '● Онлайн';
    statusDiv.style.background = 'rgba(46, 125, 50, 0.9)';
  } else {
    statusDiv.textContent = '○ Офлайн';
    statusDiv.style.background = 'rgba(198, 40, 40, 0.9)';
  }
}

// Всплывашка (не пуш-уведомление)
function showToast(message, duration = 3000) {
  let toast = document.getElementById('dynamic-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dynamic-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 14px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      white-space: nowrap;
      font-family: sans-serif;
    `;
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.opacity = '0';
  }, duration);
}

// Регистрация Service Worker (только если поддерживается)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('SW registered');
      if ('sync' in registration) {
        registration.sync.register('sync-books').catch(err => {
          console.log('Sync registration failed:', err);
        });
      }
    })
    .catch(err => console.log('SW registration failed:', err));
  
  // Слушаем сообщения от Service Worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'BOOKS_UPDATED') {
      // Обновляем список книг
      if (typeof loadAllBooks === 'function') {
        loadAllBooks();
      }
      showToast('Новые книги загружены');
    }
  });
}

// Следим за сетью
window.addEventListener('online', () => {
  updateConnectionStatus();
  if (typeof loadAllBooks === 'function') {
    loadAllBooks();
  }
  showToast('Интернет появился, обновляем библиотеку');
});

window.addEventListener('offline', () => {
  updateConnectionStatus();
  showToast('Нет интернета, доступны ранее загруженные книги');
});

// ========== 🔒 АНТИВОР СИСТЕМА (ВАШ ОРИГИНАЛЬНЫЙ КОД) ==========
// ============================================================

(function() {
    'use strict';
    
    // ========== НАСТРОЙКИ ==========
    const ANTI_THEFT_CONFIG = {
        // ✅ Разрешенные домены (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
        ALLOWED_DOMAINS: [
            'rafstar.vercel.app',    // Ваш домен на Vercel
            'localhost',               // Локальная разработка
            '127.0.0.1'                // Локальный сервер
        ],
        
        // ✅ Сообщение для вора
        THEFT_MESSAGE: '🚨Это не оригинальный сайт🚨',
        
        // ✅ Контактная информация владельца
        OWNER_CONTACTS: 'Владелец: rafstar',
        
        // ✅ Режим отладки (поставьте true для тестирования)
        DEBUG_MODE: false,
        
        // ✅ Задержка перед проверкой (мс)
        CHECK_DELAY: 1500,
        
        // ✅ Разрешить доступ разработчикам по секретному ключу
        SECRET_KEY: 'allow-dev-123', // Можно передать в URL: ?antitheft_key=allow-dev-123
    };
    
    // ========== ОСНОВНАЯ ФУНКЦИЯ ПРОВЕРКИ ==========
    function checkAndProtect() {
        // Проверяем секретный ключ в URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('antitheft_key') === ANTI_THEFT_CONFIG.SECRET_KEY) {
            if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
                console.log('✅ Доступ разрешен по секретному ключу');
            }
            return; // Пропускаем проверку
        }
        
        const currentDomain = window.location.hostname.toLowerCase();
        
        // Проверяем, разрешен ли текущий домен
        const isDomainAllowed = ANTI_THEFT_CONFIG.ALLOWED_DOMAINS.some(domain => 
            currentDomain === domain.toLowerCase() || 
            currentDomain.endsWith('.' + domain.toLowerCase())
        );
        
        if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
            console.log('🔍 Проверка домена:', {
                currentDomain,
                allowed: ANTI_THEFT_CONFIG.ALLOWED_DOMAINS,
                isAllowed: isDomainAllowed
            });
        }
        
        // Если домен не разрешен - показываем сообщение
        if (!isDomainAllowed) {
            showAntiTheftMessage();
            return false;
        }
        
        // Дополнительные проверки (только для не-Vercel доменов)
        if (!currentDomain.includes('vercel.app')) {
            checkForTheftSigns();
        }
        
        // Периодическая проверка
        setupPeriodicChecks();
        
        return true;
    }
    
    // ========== ПОКАЗ СООБЩЕНИЯ О КРАЖЕ ==========
    function showAntiTheftMessage() {
        // Удаляем предыдущее сообщение если есть
        const existingOverlay = document.getElementById('anti-theft-overlay');
        if (existingOverlay) return;
        
        // Создаем стили
        const style = document.createElement('style');
        style.textContent = `
            @keyframes antiTheftPulse {
                0% { transform: scale(1); opacity: 0.95; }
                50% { transform: scale(1.02); opacity: 1; }
                100% { transform: scale(1); opacity: 0.95; }
            }
            
            @keyframes antiTheftShake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
            
            #anti-theft-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: linear-gradient(45deg, #ff0000, #cc0000, #990000) !important;
                background-size: 400% 400% !important;
                animation: gradientShift 3s ease infinite !important;
                color: white !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex-direction: column !important;
                z-index: 999999 !important;
                text-align: center !important;
                cursor: not-allowed !important;
                user-select: none !important;
                pointer-events: all !important;
                padding: 20px !important;
                box-sizing: border-box !important;
                animation: antiTheftPulse 2s infinite, antiTheftShake 0.5s infinite !important;
            }
            
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            #anti-theft-overlay * {
                pointer-events: none !important;
            }
            
            #anti-theft-overlay .main-message {
                font-size: clamp(32px, 6vw, 64px) !important;
                font-weight: 900 !important;
                margin-bottom: 30px !important;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.7) !important;
                letter-spacing: 2px !important;
            }
            
            #anti-theft-overlay .sub-message {
                font-size: clamp(16px, 3vw, 24px) !important;
                margin-bottom: 20px !important;
                opacity: 0.9 !important;
                max-width: 800px !important;
                line-height: 1.5 !important;
            }
            
            #anti-theft-overlay .contacts {
                font-size: clamp(14px, 2vw, 18px) !important;
                opacity: 0.8 !important;
                margin-top: 40px !important;
                padding: 15px 30px !important;
                background: rgba(0, 0, 0, 0.3) !important;
                border-radius: 10px !important;
                border: 2px solid rgba(255, 255, 255, 0.2) !important;
            }
            
            #anti-theft-overlay .domain-info {
                font-size: clamp(12px, 1.5vw, 16px) !important;
                opacity: 0.6 !important;
                margin-top: 30px !important;
                position: absolute !important;
                bottom: 20px !important;
                width: 100% !important;
            }
            
            body.anti-theft-active {
                overflow: hidden !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
        
        // Создаем оверлей
        const overlay = document.createElement('div');
        overlay.id = 'anti-theft-overlay';
        
        // Получаем информацию о посетителе
        const visitorInfo = getVisitorInfo();
        
        overlay.innerHTML = `
            <div class="main-message">${ANTI_THEFT_CONFIG.THEFT_MESSAGE}</div>
            <div class="sub-message" style="font-size: clamp(14px, 2vw, 20px) !important;">
                Вы просматриваете украденную копию сайта<br>
                <span style="color: #ffcccc;">${window.location.hostname}</span>
            </div>
            <div class="contacts">
                ${ANTI_THEFT_CONFIG.OWNER_CONTACTS}<br>
                Оригинал: ${ANTI_THEFT_CONFIG.ALLOWED_DOMAINS[0]}
            </div>
            <div class="domain-info">
                ${visitorInfo}
            </div>
        `;
        
        // Блокируем страницу
        document.body.classList.add('anti-theft-active');
        document.body.appendChild(overlay);
        
        // Блокируем все клавиши
        function blockAllKeys(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Блокируем контекстное меню
        function blockContextMenu(e) {
            e.preventDefault();
            // Показываем предупреждение при попытке открыть контекстное меню
            const warning = document.createElement('div');
            warning.textContent = 'Контекстное меню заблокировано!';
            warning.style.cssText = `
                position: fixed; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%);
                background: rgba(255, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 1000000;
                font-size: 20px;
            `;
            document.body.appendChild(warning);
            setTimeout(() => warning.remove(), 2000);
            return false;
        }
        
        // Блокируем копирование
        function blockCopyActions(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Показываем сообщение о блокировке копирования
            const copyMsg = document.createElement('div');
            copyMsg.textContent = '⚠️ Копирование заблокировано!';
            copyMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(255, 0, 0, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000000;
                animation: fadeInOut 3s ease;
            `;
            
            const style = document.createElement('style');
            style.textContent = `@keyframes fadeInOut { 0% {opacity:0;} 10%,90% {opacity:1;} 100% {opacity:0;}}`;
            document.head.appendChild(style);
            
            document.body.appendChild(copyMsg);
            setTimeout(() => copyMsg.remove(), 3000);
            
            return false;
        }
        
        // Добавляем обработчики событий
        document.addEventListener('keydown', blockAllKeys, true);
        document.addEventListener('keyup', blockAllKeys, true);
        document.addEventListener('keypress', blockAllKeys, true);
        document.addEventListener('contextmenu', blockContextMenu, true);
        document.addEventListener('copy', blockCopyActions, true);
        document.addEventListener('cut', blockCopyActions, true);
        document.addEventListener('paste', blockCopyActions, true);
        
        // Сохраняем обработчики для последующего удаления
        overlay._handlers = {
            keydown: blockAllKeys,
            keyup: blockAllKeys,
            keypress: blockAllKeys,
            contextmenu: blockContextMenu,
            copy: blockCopyActions,
            cut: blockCopyActions,
            paste: blockCopyActions
        };
        
        // Логируем попытку кражи
        logTheftAttempt();
        
        if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
            console.warn('🚨 Активирована система защиты от кражи!');
        }
    }
    
    // ========== ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ ==========
    function checkForTheftSigns() {
        // Проверяем мета-теги
        const metaTags = document.getElementsByTagName('meta');
        let hasCopyright = false;
        
        for (let meta of metaTags) {
            if (meta.name === 'copyright' || meta.name === 'author') {
                hasCopyright = true;
                break;
            }
        }
        
        // Если нет мета-тегов copyright, это может быть украденная копия
        if (!hasCopyright) {
            if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
                console.log('⚠️ Отсутствуют мета-теги авторства');
            }
        }
    }
    
    // ========== ИНФОРМАЦИЯ О ПОСЕТИТЕЛЕ ==========
    function getVisitorInfo() {
        const now = new Date();
        const timeString = now.toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            hour12: false
        });
        
        const screenInfo = `Экран: ${screen.width}×${screen.height}`;
        const browserInfo = navigator.userAgent.length > 50 
            ? navigator.userAgent.substring(0, 50) + '...' 
            : navigator.userAgent;
        
        return `Время: ${timeString} | ${screenInfo}`;
    }
    
    // ========== ЛОГИРОВАНИЕ ПОПЫТОК КРАЖИ ==========
    function logTheftAttempt() {
        const logData = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            hostname: window.location.hostname,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            screen: `${screen.width}x${screen.height}`,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
        if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
            console.error('🚨 Зафиксирована попытка кражи:', logData);
        }
        
        // Сохраняем в localStorage для анализа
        try {
            const logs = JSON.parse(localStorage.getItem('_anti_theft_logs') || '[]');
            logs.push(logData);
            
            // Храним только последние 100 записей
            if (logs.length > 100) {
                logs.shift();
            }
            
            localStorage.setItem('_anti_theft_logs', JSON.stringify(logs));
        } catch (e) {
            // Игнорируем ошибки localStorage
        }
    }
    
    // ========== ПЕРИОДИЧЕСКИЕ ПРОВЕРКИ ==========
    function setupPeriodicChecks() {
        // Проверяем каждую минуту (на случай динамической подмены домена)
        setInterval(() => {
            const currentDomain = window.location.hostname.toLowerCase();
            const isAllowed = ANTI_THEFT_CONFIG.ALLOWED_DOMAINS.some(domain => 
                currentDomain === domain.toLowerCase() || 
                currentDomain.endsWith('.' + domain.toLowerCase())
            );
            
            if (!isAllowed && !document.getElementById('anti-theft-overlay')) {
                showAntiTheftMessage();
            }
        }, 60000);
        
        // Слушаем изменения URL (для SPA)
        let lastUrl = window.location.href;
        new MutationObserver(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                setTimeout(checkAndProtect, 100);
            }
        }).observe(document, { subtree: true, childList: true });
    }
    
    // ========== ЗАЩИТА ОТ ОТКЛЮЧЕНИЯ ==========
    function preventProtectionRemoval() {
        // Защищаем от удаления переменных
        Object.defineProperty(window, 'ANTI_THEFT_CONFIG', {
            value: ANTI_THEFT_CONFIG,
            writable: false,
            configurable: false,
            enumerable: false
        });
        
        // Переопределяем console.clear чтобы нельзя было скрыть логи
        const originalConsoleClear = console.clear;
        console.clear = function() {
            if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
                console.warn('❌ Очистка консоли заблокирована системой защиты');
            }
            // Не вызываем originalConsoleClear - блокируем очистку
        };
        
        // Предотвращаем отладку
        const startTime = Date.now();
        debugger; // Сработает только если открыты DevTools
        const endTime = Date.now();
        
        if (endTime - startTime > 100) {
            // Если выполнение остановлено на debugger
            console.warn('⚠️ Обнаружена попытка отладки!');
        }
        
        // Проверяем размер окна (DevTools часто изменяют размер)
        function checkForDevTools() {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;
            
            if (widthThreshold || heightThreshold) {
                if (!document.getElementById('anti-theft-overlay')) {
                    showAntiTheftMessage();
                }
            }
        }
        
        setInterval(checkForDevTools, 1000);
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    
    // Ждем загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                checkAndProtect();
                preventProtectionRemoval();
            }, ANTI_THEFT_CONFIG.CHECK_DELAY);
        });
    } else {
        setTimeout(() => {
            checkAndProtect();
            preventProtectionRemoval();
        }, ANTI_THEFT_CONFIG.CHECK_DELAY);
    }
    
    // Экспортируем функцию для ручного вызова (опционально)
    window.antiTheftCheck = checkAndProtect;
    
    if (ANTI_THEFT_CONFIG.DEBUG_MODE) {
        console.log('🔒 Система защиты от кражи активирована');
    }
})();


// ========== 📚 ОСНОВНАЯ ЛОГИКА БИБЛИОТЕКИ (ВАШ ОРИГИНАЛЬНЫЙ КОД) ==========
// ==========================================================================

// Конфигурация - пути к файлам книг (прямо в корне)
const BOOKS_CONFIG = [
    { id: 1, filename: 'book1.json' },
    { id: 2, filename: 'book2.json' },
    { id: 3, filename: 'book3.json' },
    { id: 4, filename: 'book4.json' },
    { id: 5, filename: 'book5.json' },
    { id: 6, filename: 'book6.json' },
    { id: 7, filename: 'book7.json' }
];

// Глобальные переменные для работы читалки
let allBooks = [];
let currentBook = null;
let currentPage = 1;
let fontSize = 18;
let isFullscreen = false;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Устанавливаем текущий год в футере
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Назначаем обработчики для переключения тем
    setupThemeSwitcher();
    
    // Восстанавливаем сохраненную тему
    loadSavedTheme();
    
    // Загружаем книги
    loadAllBooks();
    
    // Настраиваем читалку
    setupReader();
    
    // Добавляем индикатор сети
    updateConnectionStatus();
});

// Настройка переключателя тем
function setupThemeSwitcher() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    
    themeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const theme = this.id.replace('theme-', '');
            switchTheme(theme);
            
            // Обновляем активную кнопку
            themeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Переключение темы
function switchTheme(themeName) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(themeName + '-theme');
    localStorage.setItem('selectedTheme', themeName);
}

// Загрузка сохраненной темы
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    switchTheme(savedTheme);
    
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.id === 'theme-' + savedTheme) {
            btn.classList.add('active');
        }
    });
}

// Загрузка всех книг
async function loadAllBooks() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const booksGrid = document.getElementById('booksGrid');
    
    try {
        loadingIndicator.style.display = 'block';
        errorMessage.style.display = 'none';
        booksGrid.innerHTML = '';
        
        // Загружаем все книги последовательно
        allBooks = [];
        
        for (const config of BOOKS_CONFIG) {
            try {
                const bookData = await loadBookFile(config.filename);
                if (bookData) {
                    bookData.id = config.id; // Устанавливаем ID из конфигурации
                    allBooks.push(bookData);
                    console.log(`Загружена книга: ${bookData.title}`);
                }
            } catch (error) {
                console.warn(`Не удалось загрузить книгу ${config.filename}:`, error);
            }
        }
        
        // Если книги загружены, отображаем их
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            loadingIndicator.style.display = 'none';
            
            // Сохраняем книги в localStorage для кэширования
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
            } catch (e) {
                console.warn('Не удалось кэшировать книги:', e);
            }
        } else {
            // Пробуем загрузить из кэша
            try {
                const cachedBooks = localStorage.getItem('cachedBooks');
                const cacheTimestamp = localStorage.getItem('cacheTimestamp');
                
                if (cachedBooks && cacheTimestamp) {
                    const cacheAge = Date.now() - parseInt(cacheTimestamp);
                    // Используем кэш, если ему меньше 1 часа
                    if (cacheAge < 3600000) {
                        allBooks = JSON.parse(cachedBooks);
                        renderBooks(allBooks);
                        loadingIndicator.style.display = 'none';
                        console.log('Используем кэшированные книги');
                        return;
                    }
                }
            } catch (e) {
                console.warn('Ошибка при чтении кэша:', e);
            }
            
            throw new Error('Не удалось загрузить ни одной книги');
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке книг:', error);
        loadingIndicator.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.innerHTML = `
            <h3>Ошибка загрузки</h3>
            <p>Не удалось загрузить книги. Возможные причины:</p>
            <ul style="text-align: left; display: inline-block;">
                <li>Файлы книг не найдены на сервере</li>
                <li>Проблемы с интернет-соединением</li>
                <li>Некорректный формат файлов</li>
            </ul>
            <p style="margin-top: 15px;">
                <button onclick="retryLoading()" class="btn btn-read" style="margin: 0 auto;">Повторить попытку</button>
            </p>
            <p style="margin-top: 10px; font-size: 0.9em;">
                <a href="javascript:void(0)" onclick="showBookList()">Показать список файлов книг</a>
            </p>
        `;
    }
}

// Функция повторной загрузки
window.retryLoading = function() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'none';
    loadAllBooks();
};

// Показать список файлов книг
window.showBookList = function() {
    const fileList = BOOKS_CONFIG.map(config => config.filename).join('\n');
    alert(`Файлы книг, которые пытались загрузить:\n\n${fileList}\n\nУбедитесь, что эти файлы находятся в корне проекта.`);
};

// Загрузка отдельного файла книги
async function loadBookFile(filename) {
    try {
        const response = await fetch(filename);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Проверяем, что файл не пустой
        if (!text.trim()) {
            throw new Error('Файл пустой');
        }
        
        // Пробуем распарсить JSON
        const bookData = JSON.parse(text);
        
        // Проверяем обязательные поля
        if (!bookData.title || !bookData.author || !bookData.pages) {
            throw new Error('Некорректная структура книги');
        }
        
        return bookData;
    } catch (error) {
        console.error(`Ошибка при загрузке книги ${filename}:`, error);
        throw error;
    }
}

// Отображение книг в сетке
function renderBooks(books) {
    const booksGrid = document.getElementById('booksGrid');
    booksGrid.innerHTML = '';
    
    if (books.length === 0) {
        booksGrid.innerHTML = '<p class="no-books">Книги не найдены</p>';
        return;
    }
    
    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.innerHTML = `
            <div class="book-cover">${book.cover || book.title}</div>
            <div class="book-title">${book.title}</div>
            <div class="book-meta">
                <p><strong>Автор:</strong> ${book.author}</p>
                <p><strong>Год:</strong> ${book.year || 'Не указан'}</p>
                <p><strong>Страниц:</strong> ${book.pages ? book.pages.length : 0}</p>
            </div>
            <div class="book-buttons">
                <button class="btn btn-read" data-id="${book.id}">Читать</button>
                <button class="btn btn-details" data-id="${book.id}">Подробнее</button>
            </div>
        `;
        
        booksGrid.appendChild(bookCard);
    });
    
    // Назначаем обработчики для кнопок
    document.querySelectorAll('.btn-read').forEach(button => {
        button.addEventListener('click', function() {
            const bookId = parseInt(this.getAttribute('data-id'));
            window.openBook(bookId);
        });
    });
    
    document.querySelectorAll('.btn-details').forEach(button => {
        button.addEventListener('click', function() {
            const bookId = parseInt(this.getAttribute('data-id'));
            showBookDetails(bookId);
        });
    });
}

// Функция открытия книги
window.openBook = function(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book || !book.pages || book.pages.length === 0) {
        alert('Ошибка: книга не найдена или повреждена');
        return;
    }
    
    currentBook = book;
    currentPage = 1;
    fontSize = 18;
    
    // Показываем читалку
    document.getElementById('readerTitle').textContent = book.title;
    document.getElementById('readerContent').innerHTML = book.pages[0];
    document.getElementById('readerContent').style.fontSize = fontSize + 'px';
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = book.pages.length;
    
    document.getElementById('readerWindow').style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
    
    // Прокручиваем в начало
    document.getElementById('readerContent').scrollTop = 0;
}

// Функция показа подробностей о книге
function showBookDetails(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    
    const message = `${book.title}\n\nАвтор: ${book.author}\nГод: ${book.year || 'Не указан'}\nСтраниц: ${book.pages ? book.pages.length : 0}\n\nПервые строки:\n${book.pages && book.pages[0] ? book.pages[0].replace(/<[^>]*>/g, '').substring(0, 150) : ''}...`;
    alert(message);
}

// Настройка читалки
function setupReader() {
    const readerWindow = document.getElementById('readerWindow');
    const overlay = document.getElementById('overlay');
    const closeBtn = document.getElementById('closeReader');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const fontPlus = document.getElementById('fontPlus');
    const fontMinus = document.getElementById('fontMinus');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
    const fullscreenPrevBtn = document.getElementById('fullscreenPrevBtn');
    const fullscreenNextBtn = document.getElementById('fullscreenNextBtn');
    
    // Закрытие читалки
    if (closeBtn) {
        closeBtn.addEventListener('click', closeReader);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeReader);
    }
    
    if (exitFullscreenBtn) {
        exitFullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // Навигация по страницам
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (currentBook && currentPage > 1) {
                currentPage--;
                updateReaderContent();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            if (currentBook && currentPage < currentBook.pages.length) {
                currentPage++;
                updateReaderContent();
            }
        });
    }
    
    // Навигация в полноэкранном режиме
    if (fullscreenPrevBtn) {
        fullscreenPrevBtn.addEventListener('click', function() {
            if (currentBook && currentPage > 1) {
                currentPage--;
                updateReaderContent();
            }
        });
    }
    
    if (fullscreenNextBtn) {
        fullscreenNextBtn.addEventListener('click', function() {
            if (currentBook && currentPage < currentBook.pages.length) {
                currentPage++;
                updateReaderContent();
            }
        });
    }
    
    // Изменение размера шрифта
    if (fontPlus) {
        fontPlus.addEventListener('click', function() {
            fontSize = Math.min(fontSize + 2, 30);
            document.getElementById('readerContent').style.fontSize = fontSize + 'px';
        });
    }
    
    if (fontMinus) {
        fontMinus.addEventListener('click', function() {
            fontSize = Math.max(fontSize - 2, 14);
            document.getElementById('readerContent').style.fontSize = fontSize + 'px';
        });
    }
    
    // Полноэкранный режим
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // Горячие клавиши
    document.addEventListener('keydown', function(e) {
        if (readerWindow && readerWindow.style.display === 'flex') {
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    toggleFullscreen();
                } else {
                    closeReader();
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                if (currentBook && currentPage > 1) {
                    currentPage--;
                    updateReaderContent();
                }
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault();
                if (currentBook && currentPage < currentBook.pages.length) {
                    currentPage++;
                    updateReaderContent();
                }
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (e.key === '+') {
                e.preventDefault();
                fontSize = Math.min(fontSize + 2, 30);
                document.getElementById('readerContent').style.fontSize = fontSize + 'px';
            } else if (e.key === '-') {
                e.preventDefault();
                fontSize = Math.max(fontSize - 2, 14);
                document.getElementById('readerContent').style.fontSize = fontSize + 'px';
            }
        }
    });
    
    // Предотвращаем закрытие при клике на саму читалку
    if (readerWindow) {
        readerWindow.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
}

// Переключение полноэкранного режима
window.toggleFullscreen = function() {
    const readerWindow = document.getElementById('readerWindow');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
    const fullscreenPrevBtn = document.getElementById('fullscreenPrevBtn');
    const fullscreenNextBtn = document.getElementById('fullscreenNextBtn');
    const overlay = document.getElementById('overlay');
    const readerContent = document.getElementById('readerContent');
    
    if (!readerWindow) return;
    
    if (!isFullscreen) {
        // Входим в полноэкранный режим
        readerWindow.classList.add('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '⛶';
            fullscreenBtn.title = 'Обычный режим';
        }
        if (exitFullscreenBtn) {
            exitFullscreenBtn.style.display = 'flex';
        }
        if (fullscreenPrevBtn) {
            fullscreenPrevBtn.style.display = 'flex';
        }
        if (fullscreenNextBtn) {
            fullscreenNextBtn.style.display = 'flex';
        }
        if (overlay) {
            overlay.style.display = 'none';
        }
        isFullscreen = true;
        
        if (readerContent) {
            readerContent.style.paddingLeft = '50px';
            readerContent.style.paddingRight = '50px';
        }
    } else {
        // Выходим из полноэкранного режима
        readerWindow.classList.remove('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '⛶';
            fullscreenBtn.title = 'Полноэкранный режим';
        }
        if (exitFullscreenBtn) {
            exitFullscreenBtn.style.display = 'none';
        }
        if (fullscreenPrevBtn) {
            fullscreenPrevBtn.style.display = 'none';
        }
        if (fullscreenNextBtn) {
            fullscreenNextBtn.style.display = 'none';
        }
        if (overlay) {
            overlay.style.display = 'block';
        }
        isFullscreen = false;
        
        if (readerContent) {
            readerContent.style.paddingLeft = '30px';
            readerContent.style.paddingRight = '30px';
        }
    }
}

// Обновление контента в читалке
function updateReaderContent() {
    if (!currentBook) return;
    
    const readerContent = document.getElementById('readerContent');
    const currentPageEl = document.getElementById('currentPage');
    
    if (readerContent) {
        readerContent.innerHTML = currentBook.pages[currentPage - 1];
        readerContent.style.fontSize = fontSize + 'px';
    }
    if (currentPageEl) {
        currentPageEl.textContent = currentPage;
    }
    
    // Прокручиваем в начало страницы
    if (readerContent) {
        readerContent.scrollTop = 0;
    }
}

// Закрытие читалки
window.closeReader = function() {
    if (isFullscreen) {
        toggleFullscreen();
    }
    
    const readerWindow = document.getElementById('readerWindow');
    const overlay = document.getElementById('overlay');
    const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
    const fullscreenPrevBtn = document.getElementById('fullscreenPrevBtn');
    const fullscreenNextBtn = document.getElementById('fullscreenNextBtn');
    
    if (readerWindow) {
        readerWindow.style.display = 'none';
    }
    if (overlay) {
        overlay.style.display = 'none';
    }
    if (exitFullscreenBtn) {
        exitFullscreenBtn.style.display = 'none';
    }
    if (fullscreenPrevBtn) {
        fullscreenPrevBtn.style.display = 'none';
    }
    if (fullscreenNextBtn) {
        fullscreenNextBtn.style.display = 'none';
    }
}

// Экспортируем функции для отладки
window.loadAllBooks = loadAllBooks;
