// ========== 🚀 ОФЛАЙН-СИНХРОНИЗАЦИЯ (ДОБАВЛЕНО) ==========
// =======================================================

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
    statusDiv.style.background = 'rgba(128, 128, 128, 0.9)';
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
      showToast('Книги загружены');
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


// ========== 📚 ОСНОВНАЯ ЛОГИКА БИБЛИОТЕКИ ==========
// ==================================================

// Глобальные переменные для работы читалки
let allBooks = [];
let currentBook = null;
let currentPage = 1;
let fontSize = 18;
let isFullscreen = false;

// ========== ДИНАМИЧЕСКАЯ ПАГИНАЦИЯ ==========

// Настройки для разных устройств
const DEVICE_CONFIG = {
    mobile: {
        name: 'mobile',
        charsPerPage: 800,
        fontSize: 14,
        lineHeight: 1.5,
        padding: 15
    },
    tablet: {
        name: 'tablet',
        charsPerPage: 1200,
        fontSize: 16,
        lineHeight: 1.6,
        padding: 25
    },
    desktop: {
        name: 'desktop',
        charsPerPage: 1800,
        fontSize: 18,
        lineHeight: 1.8,
        padding: 40
    }
};

// Определение типа устройства
function getDeviceType() {
    const width = window.innerWidth;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (width <= 480 || (isMobile && width <= 768)) return 'mobile';
    if (width <= 768) return 'tablet';
    return 'desktop';
}

// Разбивка HTML-контента на страницы
function splitHtmlIntoPages(htmlContent, charsPerPage) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const totalChars = textContent.length;
    
    if (totalChars <= charsPerPage) {
        return [htmlContent];
    }
    
    const paragraphs = [];
    const pTags = tempDiv.querySelectorAll('p');
    
    if (pTags.length > 0) {
        for (let i = 0; i < pTags.length; i++) {
            paragraphs.push(pTags[i].outerHTML);
        }
    } else {
        const lines = htmlContent.split(/<br\s*\/?>/i);
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
                paragraphs.push(lines[i]);
            }
        }
    }
    
    const pages = [];
    let currentPageHtml = '';
    let currentLength = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const paragraphText = paragraph.replace(/<[^>]*>/g, '');
        const paragraphLength = paragraphText.length;
        
        if (paragraphLength > charsPerPage) {
            if (currentPageHtml) {
                pages.push(currentPageHtml);
                currentPageHtml = '';
                currentLength = 0;
            }
            
            const words = paragraph.split(/(\s+)/);
            let tempPage = '';
            let tempLength = 0;
            
            for (let j = 0; j < words.length; j++) {
                const word = words[j];
                const wordText = word.replace(/<[^>]*>/g, '');
                const wordLength = wordText.length;
                
                if (tempLength + wordLength > charsPerPage && tempPage) {
                    pages.push(tempPage);
                    tempPage = word;
                    tempLength = wordLength;
                } else {
                    tempPage += word;
                    tempLength += wordLength;
                }
            }
            
            if (tempPage) {
                pages.push(tempPage);
            }
        } else if (currentLength + paragraphLength <= charsPerPage) {
            currentPageHtml += paragraph;
            currentLength += paragraphLength;
        } else {
            if (currentPageHtml) {
                pages.push(currentPageHtml);
            }
            currentPageHtml = paragraph;
            currentLength = paragraphLength;
        }
    }
    
    if (currentPageHtml) {
        pages.push(currentPageHtml);
    }
    
    return pages.length > 0 ? pages : [htmlContent];
}

// Перепагинация книги
function repaginateBook(book) {
    if (!book) return book;
    
    const device = getDeviceType();
    const config = DEVICE_CONFIG[device];
    
    if (!book.originalPages) {
        book.originalPages = [...book.pages];
    }
    
    const newPages = [];
    for (let i = 0; i < book.originalPages.length; i++) {
        const splitPages = splitHtmlIntoPages(book.originalPages[i], config.charsPerPage);
        for (let j = 0; j < splitPages.length; j++) {
            newPages.push(splitPages[j]);
        }
    }
    
    book.pages = newPages;
    book.deviceType = device;
    
    return book;
}

// Применение стилей устройства
function applyDeviceStyles() {
    const device = getDeviceType();
    const config = DEVICE_CONFIG[device];
    
    const root = document.documentElement;
    root.style.setProperty('--reader-font-size', config.fontSize + 'px');
    root.style.setProperty('--reader-line-height', config.lineHeight);
    root.style.setProperty('--reader-padding', config.padding + 'px');
    
    const readerContent = document.getElementById('readerContent');
    if (readerContent) {
        readerContent.style.fontSize = config.fontSize + 'px';
        readerContent.style.lineHeight = config.lineHeight;
        readerContent.style.padding = config.padding + 'px';
    }
    
    return config;
}

// Сохранение прогресса
function saveReadingProgress(bookId, page) {
    if (!bookId) return;
    try {
        const progress = JSON.parse(localStorage.getItem('readingProgress') || '{}');
        progress[bookId] = page;
        localStorage.setItem('readingProgress', JSON.stringify(progress));
    } catch (e) {}
}

function getReadingProgress(bookId) {
    if (!bookId) return 1;
    try {
        const progress = JSON.parse(localStorage.getItem('readingProgress') || '{}');
        return progress[bookId] || 1;
    } catch (e) {
        return 1;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    setupThemeSwitcher();
    loadSavedTheme();
    setupReader();
    updateConnectionStatus();
    
    // Добавляем CSS переменные
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --reader-font-size: 18px;
            --reader-line-height: 1.8;
            --reader-padding: 40px;
        }
        
        .reader-content {
            font-size: var(--reader-font-size);
            line-height: var(--reader-line-height);
            padding: var(--reader-padding);
            transition: all 0.3s ease;
        }
        
        @media (max-width: 768px) {
            .page-nav-btn {
                width: 40px;
                height: 40px;
                font-size: 1.2rem;
            }
            .reader-btn {
                padding: 8px 12px;
                font-size: 0.9rem;
            }
            .font-btn, .fullscreen-btn {
                width: 35px;
                height: 35px;
                font-size: 1rem;
            }
            .page-indicator {
                font-size: 0.9rem;
                min-width: 100px;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Загружаем книги
    loadAllBooks();
});

// Следим за изменением размера экрана
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (currentBook && document.getElementById('readerWindow').style.display === 'flex') {
            const oldPage = currentPage;
            
            repaginateBook(currentBook);
            
            if (oldPage > currentBook.pages.length) {
                currentPage = currentBook.pages.length;
            } else {
                currentPage = oldPage;
            }
            
            updateReaderContent();
            
            const totalPagesEl = document.getElementById('totalPages');
            if (totalPagesEl) totalPagesEl.textContent = currentBook.pages.length;
            
            if (currentBook.id) saveReadingProgress(currentBook.id, currentPage);
            
            applyDeviceStyles();
        }
    }, 300);
});

// Настройка переключателя тем
function setupThemeSwitcher() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    
    themeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const theme = this.id.replace('theme-', '');
            switchTheme(theme);
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

// Загрузка всех книг ИЗ ФАЙЛА books-list.json
async function loadAllBooks() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const booksGrid = document.getElementById('booksGrid');
    
    try {
        loadingIndicator.style.display = 'block';
        errorMessage.style.display = 'none';
        booksGrid.innerHTML = '';
        
        // 1. Сначала загружаем список файлов из books-list.json
        const listResponse = await fetch('books-list.json');
        
        if (!listResponse.ok) {
            throw new Error(`Не удалось загрузить books-list.json (${listResponse.status})`);
        }
        
        const bookFiles = await listResponse.json();
        
        if (!Array.isArray(bookFiles) || bookFiles.length === 0) {
            throw new Error('books-list.json пуст или имеет неверный формат');
        }
        
        console.log('📚 Загружены файлы книг:', bookFiles);
        
        // 2. Загружаем каждую книгу по очереди
        allBooks = [];
        
        for (let i = 0; i < bookFiles.length; i++) {
            const filename = bookFiles[i];
            try {
                const bookData = await loadBookFile(filename);
                if (bookData) {
                    bookData.id = i + 1; // Устанавливаем ID (начиная с 1)
                    allBooks.push(bookData);
                    console.log(`✅ Загружена книга: ${bookData.title}`);
                }
            } catch (error) {
                console.warn(`⚠️ Не удалось загрузить книгу ${filename}:`, error);
            }
        }
        
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            loadingIndicator.style.display = 'none';
            
            // Сохраняем книги в localStorage для кэширования
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
                localStorage.setItem('cachedBookFiles', JSON.stringify(bookFiles));
            } catch (e) {
                console.warn('Не удалось кэшировать книги:', e);
            }
        } else {
            // Пробуем загрузить из кэша
            const cacheLoaded = await loadFromCache();
            if (!cacheLoaded) {
                throw new Error('Не удалось загрузить ни одной книги');
            }
            loadingIndicator.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке книг:', error);
        
        // Пробуем загрузить из кэша
        const cacheLoaded = await loadFromCache();
        
        if (!cacheLoaded) {
            loadingIndicator.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.innerHTML = `
                <h3>❌ Ошибка загрузки</h3>
                <p>Не удалось загрузить книги.</p>
                <p style="font-size: 0.9em; color: #666;">Файл books-list.json не найден или имеет неверный формат.</p>
                <p style="margin-top: 15px;">
                    <button onclick="retryLoading()" class="btn btn-read" style="margin: 0 auto;">🔄 Повторить попытку</button>
                </p>
            `;
        } else {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Загрузка из кэша localStorage
async function loadFromCache() {
    try {
        const cachedBooks = localStorage.getItem('cachedBooks');
        const cachedBookFiles = localStorage.getItem('cachedBookFiles');
        const cacheTimestamp = localStorage.getItem('cacheTimestamp');
        
        if (cachedBooks && cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp);
            // Используем кэш если ему меньше 24 часов
            if (cacheAge < 86400000) {
                allBooks = JSON.parse(cachedBooks);
                renderBooks(allBooks);
                console.log(`📦 Используем кэшированные книги (${allBooks.length} шт.)`);
                showToast('📚 Книги загружены из кэша');
                return true;
            }
        }
    } catch (e) {
        console.warn('Ошибка при чтении кэша:', e);
    }
    return false;
}

// Функция повторной загрузки
window.retryLoading = function() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'none';
    loadAllBooks();
};

// Загрузка отдельного файла книги
async function loadBookFile(filename) {
    try {
        const response = await fetch(filename);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        if (!text.trim()) {
            throw new Error('Файл пустой');
        }
        
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
        booksGrid.innerHTML = '<p class="no-books">📭 Книги не найдены</p>';
        return;
    }
    
    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.innerHTML = `
            <div class="book-cover">${escapeHtml(book.cover || book.title)}</div>
            <div class="book-title">${escapeHtml(book.title)}</div>
            <div class="book-meta">
                <p><strong>Автор:</strong> ${escapeHtml(book.author)}</p>
                <p><strong>Год:</strong> ${escapeHtml(book.year || 'Не указан')}</p>
                <p><strong>Страниц:</strong> ${book.pages ? book.pages.length : 0}</p>
            </div>
            <div class="book-buttons">
                <button class="btn btn-read" data-id="${book.id}">📖 Читать</button>
                <button class="btn btn-details" data-id="${book.id}">ℹ️ Подробнее</button>
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Функция открытия книги с динамической пагинацией
window.openBook = function(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book || !book.pages || book.pages.length === 0) {
        alert('Ошибка: книга не найдена или повреждена');
        return;
    }
    
    currentBook = JSON.parse(JSON.stringify(book));
    
    if (!currentBook.originalPages) {
        currentBook.originalPages = [...currentBook.pages];
    }
    
    repaginateBook(currentBook);
    
    currentPage = getReadingProgress(bookId);
    if (currentPage > currentBook.pages.length) currentPage = 1;
    
    applyDeviceStyles();
    
    document.getElementById('readerTitle').textContent = currentBook.title;
    document.getElementById('readerContent').innerHTML = currentBook.pages[currentPage - 1];
    document.getElementById('readerContent').style.fontSize = fontSize + 'px';
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = currentBook.pages.length;
    
    document.getElementById('readerWindow').style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('readerContent').scrollTop = 0;
}

// Функция показа подробностей о книге
function showBookDetails(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    
    const preview = book.pages && book.pages[0] ? book.pages[0].replace(/<[^>]*>/g, '').substring(0, 200) : '';
    alert(`${book.title}\n\n📝 Автор: ${book.author}\n📅 Год: ${book.year || 'Не указан'}\n📄 Страниц: ${book.pages ? book.pages.length : 0}\n\n📖 Первые строки:\n${preview}...`);
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
    
    if (closeBtn) closeBtn.addEventListener('click', closeReader);
    if (overlay) overlay.addEventListener('click', closeReader);
    if (exitFullscreenBtn) exitFullscreenBtn.addEventListener('click', toggleFullscreen);
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (currentBook && currentPage > 1) {
                currentPage--;
                updateReaderContent();
                if (currentBook.id) saveReadingProgress(currentBook.id, currentPage);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            if (currentBook && currentPage < currentBook.pages.length) {
                currentPage++;
                updateReaderContent();
                if (currentBook.id) saveReadingProgress(currentBook.id, currentPage);
            }
        });
    }
    
    if (fullscreenPrevBtn) {
        fullscreenPrevBtn.addEventListener('click', function() {
            if (currentBook && currentPage > 1) {
                currentPage--;
                updateReaderContent();
                if (currentBook.id) saveReadingProgress(currentBook.id, currentPage);
            }
        });
    }
    
    if (fullscreenNextBtn) {
        fullscreenNextBtn.addEventListener('click', function() {
            if (currentBook && currentPage < currentBook.pages.length) {
                currentPage++;
                updateReaderContent();
                if (currentBook.id) saveReadingProgress(currentBook.id, currentPage);
            }
        });
    }
    
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
    
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    document.addEventListener('keydown', function(e) {
        if (readerWindow && readerWindow.style.display === 'flex') {
            if (e.key === 'Escape') {
                if (isFullscreen) toggleFullscreen();
                else closeReader();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                if (currentBook && currentPage > 1) {
                    currentPage--;
                    updateReaderContent();
                    if (currentBook.id) saveReadingProgress(currentBook.id, currentPage);
                }
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault();
                if (currentBook && currentPage < currentBook.pages.length) {
                    currentPage++;
                    updateReaderContent();
                    if (currentBook.id) saveReadingProgress(currentBook.id, currentPage);
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
        readerWindow.classList.add('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '✕';
            fullscreenBtn.title = 'Обычный режим';
        }
        if (exitFullscreenBtn) exitFullscreenBtn.style.display = 'flex';
        if (fullscreenPrevBtn) fullscreenPrevBtn.style.display = 'flex';
        if (fullscreenNextBtn) fullscreenNextBtn.style.display = 'flex';
        if (overlay) overlay.style.display = 'none';
        isFullscreen = true;
        if (readerContent) {
            readerContent.style.paddingLeft = '50px';
            readerContent.style.paddingRight = '50px';
        }
    } else {
        readerWindow.classList.remove('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '⛶';
            fullscreenBtn.title = 'Полноэкранный режим';
        }
        if (exitFullscreenBtn) exitFullscreenBtn.style.display = 'none';
        if (fullscreenPrevBtn) fullscreenPrevBtn.style.display = 'none';
        if (fullscreenNextBtn) fullscreenNextBtn.style.display = 'none';
        if (overlay) overlay.style.display = 'block';
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
        readerContent.scrollTop = 0;
    }
    if (currentPageEl) currentPageEl.textContent = currentPage;
}

// Закрытие читалки
window.closeReader = function() {
    if (currentBook && currentBook.id) {
        saveReadingProgress(currentBook.id, currentPage);
    }
    
    if (isFullscreen) toggleFullscreen();
    
    const readerWindow = document.getElementById('readerWindow');
    const overlay = document.getElementById('overlay');
    const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
    const fullscreenPrevBtn = document.getElementById('fullscreenPrevBtn');
    const fullscreenNextBtn = document.getElementById('fullscreenNextBtn');
    
    if (readerWindow) readerWindow.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (exitFullscreenBtn) exitFullscreenBtn.style.display = 'none';
    if (fullscreenPrevBtn) fullscreenPrevBtn.style.display = 'none';
    if (fullscreenNextBtn) fullscreenNextBtn.style.display = 'none';
}

// Экспортируем функции для отладки
window.loadAllBooks = loadAllBooks;
