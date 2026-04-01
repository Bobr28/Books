// ========== 🚀 ОФЛАЙН-СИНХРОНИЗАЦИЯ ==========
// =============================================

let offlineReady = false;
let isLoading = false;
let loadStartTime = 0;

// Отображение статуса подключения
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

// Регистрация Service Worker
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
  
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'BOOKS_UPDATED') {
      if (typeof window.loadAllBooks === 'function' && !isLoading) {
        window.loadAllBooks();
      }
      showToast('📚 Книги загружены');
    }
  });
}

window.addEventListener('online', () => {
  updateConnectionStatus();
  if (typeof window.loadAllBooks === 'function' && !isLoading) {
    window.loadAllBooks();
  }
  showToast('🌐 Интернет появился');
});

window.addEventListener('offline', () => {
  updateConnectionStatus();
  showToast('📴 Офлайн режим');
});

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

if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}

// ========== 🔒 АНТИВОР СИСТЕМА ==========
// ========================================

(function() {
    'use strict';

    const ANTI_THEFT_CONFIG = {
        ALLOWED_DOMAINS: [
            'rafstar.vercel.app',
            'localhost',
            '127.0.0.1',
        ],
        THEFT_MESSAGE: '🚨 Это не оригинальный сайт 🚨',
        OWNER_CONTACTS: 'Владелец: rafstar',
        CHECK_DELAY: 1500,
        SECRET_KEY: 'allow-dev-123',
    };

    function checkAndProtect() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('antitheft_key') === ANTI_THEFT_CONFIG.SECRET_KEY) {
            return;
        }
        
        const currentDomain = window.location.hostname.toLowerCase();
        const isDomainAllowed = ANTI_THEFT_CONFIG.ALLOWED_DOMAINS.some(domain => 
            currentDomain === domain.toLowerCase()
        );
        
        if (!isDomainAllowed) {
            showAntiTheftMessage();
            return false;
        }
        
        setupPeriodicChecks();
        return true;
    }
    
    function showAntiTheftMessage() {
        if (document.getElementById('anti-theft-overlay')) return;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
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
                padding: 20px !important;
                box-sizing: border-box !important;
            }
            
            #anti-theft-overlay .main-message {
                font-size: clamp(32px, 6vw, 64px) !important;
                font-weight: 900 !important;
                margin-bottom: 30px !important;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.7) !important;
            }
            
            #anti-theft-overlay .sub-message {
                font-size: clamp(16px, 3vw, 24px) !important;
                margin-bottom: 20px !important;
                opacity: 0.9 !important;
                max-width: 800px !important;
            }
            
            #anti-theft-overlay .contacts {
                font-size: clamp(14px, 2vw, 18px) !important;
                opacity: 0.8 !important;
                margin-top: 40px !important;
                padding: 15px 30px !important;
                background: rgba(0, 0, 0, 0.3) !important;
                border-radius: 10px !important;
            }
            
            body.anti-theft-active {
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(style);
        
        const overlay = document.createElement('div');
        overlay.id = 'anti-theft-overlay';
        
        overlay.innerHTML = `
            <div class="main-message">${ANTI_THEFT_CONFIG.THEFT_MESSAGE}</div>
            <div class="sub-message">
                Вы просматриваете украденную копию сайта<br>
                <span style="color: #ffcccc;">${window.location.hostname}</span>
            </div>
            <div class="contacts">
                ${ANTI_THEFT_CONFIG.OWNER_CONTACTS}<br>
                Оригинал: ${ANTI_THEFT_CONFIG.ALLOWED_DOMAINS[0]}
            </div>
        `;
        
        document.body.classList.add('anti-theft-active');
        document.body.appendChild(overlay);
        
        function blockAllKeys(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        function blockContextMenu(e) {
            e.preventDefault();
            return false;
        }
        
        document.addEventListener('keydown', blockAllKeys, true);
        document.addEventListener('contextmenu', blockContextMenu, true);
    }
    
    function setupPeriodicChecks() {
        setInterval(() => {
            const currentDomain = window.location.hostname.toLowerCase();
            const isAllowed = ANTI_THEFT_CONFIG.ALLOWED_DOMAINS.some(domain => 
                currentDomain === domain.toLowerCase()
            );
            
            if (!isAllowed && !document.getElementById('anti-theft-overlay')) {
                showAntiTheftMessage();
            }
        }, 60000);
    }
    
    function preventProtectionRemoval() {
        Object.defineProperty(window, 'ANTI_THEFT_CONFIG', {
            value: ANTI_THEFT_CONFIG,
            writable: false,
            configurable: false,
            enumerable: false
        });
    }
    
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
    
    window.antiTheftCheck = checkAndProtect;
})();

// ========== 📚 ОПТИМИЗИРОВАННАЯ ЛОГИКА БИБЛИОТЕКИ ==========
// ===========================================================

let BOOKS_CONFIG = [];
let allBooks = [];
let currentBook = null;
let currentPage = 1;
let fontSize = 18;
let isFullscreen = false;

// Кэш для загруженных книг
const bookCache = new Map();
let preloadQueue = [];

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    loadStartTime = performance.now();
    
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    setupThemeSwitcher();
    loadSavedTheme();
    setupReader();
    updateConnectionStatus();
    
    // Мгновенная загрузка из кэша
    await loadFromCacheImmediately();
    
    // Фоновая загрузка обновлений
    setTimeout(() => {
        loadBooksList();
    }, 100);
});

// Мгновенная загрузка из кэша
async function loadFromCacheImmediately() {
    try {
        const cachedBooks = localStorage.getItem('cachedBooks');
        const cacheTimestamp = localStorage.getItem('cacheTimestamp');
        
        if (cachedBooks && cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp);
            // Используем кэш если ему меньше 24 часов
            if (cacheAge < 86400000) {
                allBooks = JSON.parse(cachedBooks);
                if (allBooks.length > 0) {
                    renderBooks(allBooks);
                    console.log(`⚡ Мгновенная загрузка из кэша: ${allBooks.length} книг за ${Math.round(performance.now() - loadStartTime)}мс`);
                    // Убрал тост с эмодзи книги
                    return true;
                }
            }
        }
    } catch (e) {
        console.warn('Ошибка загрузки кэша:', e);
    }
    return false;
}

// Оптимизированная загрузка списка книг
async function loadBooksList() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        // Параллельная загрузка: сначала показываем кэш, потом обновляем
        const cacheLoaded = await loadFromCacheImmediately();
        
        // Загружаем список книг с таймаутом
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        let response;
        try {
            response = await fetch('books-list.json', { signal: controller.signal });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (!cacheLoaded) {
                // Используем стандартный список
                BOOKS_CONFIG = Array.from({ length: 7 }, (_, i) => ({
                    id: i + 1,
                    filename: `book${i + 1}.json`
                }));
                await loadAllBooksParallel();
            }
            isLoading = false;
            return;
        }
        
        if (!response.ok) {
            if (!cacheLoaded) {
                BOOKS_CONFIG = Array.from({ length: 7 }, (_, i) => ({
                    id: i + 1,
                    filename: `book${i + 1}.json`
                }));
                await loadAllBooksParallel();
            }
            isLoading = false;
            return;
        }
        
        const bookFiles = await response.json();
        
        if (Array.isArray(bookFiles) && bookFiles.length > 0) {
            BOOKS_CONFIG = bookFiles.map((filename, index) => ({
                id: index + 1,
                filename: filename
            }));
        } else if (!cacheLoaded) {
            BOOKS_CONFIG = Array.from({ length: 7 }, (_, i) => ({
                id: i + 1,
                filename: `book${i + 1}.json`
            }));
        }
        
        // Параллельная загрузка книг
        await loadAllBooksParallel();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        const cacheLoaded = allBooks.length > 0;
        if (!cacheLoaded) {
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.style.display = 'block';
                errorMessage.innerHTML = `
                    <h3>📖 Ошибка загрузки</h3>
                    <p>Не удалось загрузить книги. Проверьте подключение к интернету.</p>
                    <p><button onclick="window.retryLoading()" class="btn btn-read">🔄 Повторить</button></p>
                `;
            }
        }
    } finally {
        isLoading = false;
    }
}

// Параллельная загрузка всех книг (оптимизация скорости)
async function loadAllBooksParallel() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const booksGrid = document.getElementById('booksGrid');
    
    if (!booksGrid) return;
    
    // Если книги уже загружены из кэша, не показываем индикатор
    if (allBooks.length === 0 && loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    
    try {
        // Загружаем все книги параллельно (основное ускорение!)
        const bookPromises = BOOKS_CONFIG.map(async (config) => {
            // Проверяем кэш в памяти
            if (bookCache.has(config.filename)) {
                return bookCache.get(config.filename);
            }
            
            try {
                const response = await fetch(config.filename);
                if (!response.ok) return null;
                
                const text = await response.text();
                if (!text || !text.trim()) return null;
                
                let bookData;
                try {
                    bookData = JSON.parse(text);
                } catch (e) {
                    return null;
                }
                
                if (!bookData.title || !bookData.author || !bookData.pages || !Array.isArray(bookData.pages)) {
                    return null;
                }
                
                bookData.id = config.id;
                
                // Сохраняем в кэш памяти
                bookCache.set(config.filename, bookData);
                
                return bookData;
            } catch (error) {
                console.warn(`Ошибка ${config.filename}:`, error.message);
                return null;
            }
        });
        
        // Ждем завершения всех загрузок
        const results = await Promise.all(bookPromises);
        
        // Фильтруем успешные загрузки
        const newBooks = results.filter(book => book !== null);
        
        if (newBooks.length > 0) {
            allBooks = newBooks;
            renderBooks(allBooks);
            
            // Сохраняем в localStorage
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
                console.log(`✅ Загружено ${allBooks.length} книг за ${Math.round(performance.now() - loadStartTime)}мс`);
                // Убрал тост с эмодзи книги
            } catch (e) {}
        } else if (allBooks.length === 0) {
            throw new Error('Нет книг');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки книг:', error);
        if (allBooks.length === 0) {
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.style.display = 'block';
                errorMessage.innerHTML = `
                    <h3>📖 Ошибка загрузки</h3>
                    <p>Не удалось загрузить книги. Проверьте наличие файлов book1.json...book7.json</p>
                    <p><button onclick="window.retryLoading()" class="btn btn-read">🔄 Повторить</button></p>
                `;
            }
        }
    } finally {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// Прелоадинг следующей книги (предзагрузка для быстрого открытия)
function preloadBook(bookId) {
    const nextBook = allBooks.find(b => b.id === bookId + 1);
    if (nextBook && !bookCache.has(`book${nextBook.id}.json`)) {
        fetch(`book${nextBook.id}.json`)
            .then(response => response.json())
            .then(data => {
                bookCache.set(`book${nextBook.id}.json`, data);
                console.log(`⚡ Предзагружена книга: ${data.title}`);
            })
            .catch(() => {});
    }
}

// Повторная загрузка
window.retryLoading = function() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) errorMessage.style.display = 'none';
    isLoading = false;
    bookCache.clear();
    loadBooksList();
};

// Оптимизированное отображение книг (с виртуализацией для больших списков)
function renderBooks(books) {
    const booksGrid = document.getElementById('booksGrid');
    if (!booksGrid) return;
    
    // Используем DocumentFragment для быстрой вставки
    const fragment = document.createDocumentFragment();
    
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
        fragment.appendChild(bookCard);
    });
    
    booksGrid.innerHTML = '';
    booksGrid.appendChild(fragment);
    
    // Делегирование событий для лучшей производительности
    booksGrid.addEventListener('click', (e) => {
        const readBtn = e.target.closest('.btn-read');
        const detailsBtn = e.target.closest('.btn-details');
        
        if (readBtn) {
            e.stopPropagation();
            const bookId = parseInt(readBtn.dataset.id);
            openBook(bookId);
            preloadBook(bookId); // Предзагружаем следующую книгу
        } else if (detailsBtn) {
            e.stopPropagation();
            const bookId = parseInt(detailsBtn.dataset.id);
            showBookDetails(bookId);
        }
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

window.openBook = function(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book || !book.pages?.length) {
        alert('Ошибка: книга не найдена');
        return;
    }
    
    currentBook = book;
    currentPage = getReadingProgress(bookId);
    if (currentPage > book.pages.length) currentPage = 1;
    
    const readerTitle = document.getElementById('readerTitle');
    const readerContent = document.getElementById('readerContent');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const readerWindow = document.getElementById('readerWindow');
    const overlay = document.getElementById('overlay');
    
    if (readerTitle) readerTitle.textContent = book.title;
    if (readerContent) {
        readerContent.innerHTML = book.pages[currentPage - 1];
        readerContent.style.fontSize = fontSize + 'px';
    }
    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = book.pages.length;
    if (readerWindow) readerWindow.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
    if (readerContent) readerContent.scrollTop = 0;
}

function showBookDetails(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    
    const preview = book.pages?.[0]?.replace(/<[^>]*>/g, '').substring(0, 150) || '';
    alert(`${book.title}\n\nАвтор: ${book.author}\nГод: ${book.year || 'Не указан'}\nСтраниц: ${book.pages?.length || 0}\n\nПервые строки:\n${preview}...`);
}

function setupThemeSwitcher() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.id.replace('theme-', '');
            switchTheme(theme);
            themeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function switchTheme(themeName) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(themeName + '-theme');
    localStorage.setItem('selectedTheme', themeName);
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    switchTheme(savedTheme);
    const btn = document.getElementById(`theme-${savedTheme}`);
    if (btn) btn.classList.add('active');
}

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
    
    if (closeBtn) closeBtn.onclick = closeReader;
    if (overlay) overlay.onclick = closeReader;
    if (exitFullscreenBtn) exitFullscreenBtn.onclick = toggleFullscreen;
    
    if (prevBtn) prevBtn.onclick = () => { if (currentBook && currentPage > 1) { currentPage--; updateReaderContent(); saveReadingProgress(currentBook.id, currentPage); } };
    if (nextBtn) nextBtn.onclick = () => { if (currentBook && currentPage < currentBook.pages.length) { currentPage++; updateReaderContent(); saveReadingProgress(currentBook.id, currentPage); } };
    if (fullscreenPrevBtn) fullscreenPrevBtn.onclick = () => { if (currentBook && currentPage > 1) { currentPage--; updateReaderContent(); saveReadingProgress(currentBook.id, currentPage); } };
    if (fullscreenNextBtn) fullscreenNextBtn.onclick = () => { if (currentBook && currentPage < currentBook.pages.length) { currentPage++; updateReaderContent(); saveReadingProgress(currentBook.id, currentPage); } };
    
    if (fontPlus) fontPlus.onclick = () => { fontSize = Math.min(fontSize + 2, 30); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; };
    if (fontMinus) fontMinus.onclick = () => { fontSize = Math.max(fontSize - 2, 14); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; };
    if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;
    
    document.addEventListener('keydown', (e) => {
        if (readerWindow?.style.display !== 'flex') return;
        if (e.key === 'Escape') { if (isFullscreen) toggleFullscreen(); else closeReader(); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (currentBook && currentPage > 1) { currentPage--; updateReaderContent(); if (currentBook.id) saveReadingProgress(currentBook.id, currentPage); } }
        else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); if (currentBook && currentPage < currentBook.pages.length) { currentPage++; updateReaderContent(); if (currentBook.id) saveReadingProgress(currentBook.id, currentPage); } }
        else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
        else if (e.key === '+') { e.preventDefault(); fontSize = Math.min(fontSize + 2, 30); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; }
        else if (e.key === '-') { e.preventDefault(); fontSize = Math.max(fontSize - 2, 14); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; }
    });
    
    if (readerWindow) readerWindow.onclick = (e) => e.stopPropagation();
}

window.toggleFullscreen = function() {
    const rw = document.getElementById('readerWindow');
    const fb = document.getElementById('fullscreenBtn');
    const efb = document.getElementById('exitFullscreenBtn');
    const fp = document.getElementById('fullscreenPrevBtn');
    const fn = document.getElementById('fullscreenNextBtn');
    const ov = document.getElementById('overlay');
    const rc = document.getElementById('readerContent');
    if (!rw) return;
    
    if (!isFullscreen) {
        rw.classList.add('fullscreen');
        if (fb) { fb.innerHTML = '✕'; fb.title = 'Обычный режим'; }
        if (efb) efb.style.display = 'flex';
        if (fp) fp.style.display = 'flex';
        if (fn) fn.style.display = 'flex';
        if (ov) ov.style.display = 'none';
        isFullscreen = true;
        if (rc) { rc.style.paddingLeft = '50px'; rc.style.paddingRight = '50px'; }
    } else {
        rw.classList.remove('fullscreen');
        if (fb) { fb.innerHTML = '⛶'; fb.title = 'Полноэкранный режим'; }
        if (efb) efb.style.display = 'none';
        if (fp) fp.style.display = 'none';
        if (fn) fn.style.display = 'none';
        if (ov) ov.style.display = 'block';
        isFullscreen = false;
        if (rc) { rc.style.paddingLeft = '30px'; rc.style.paddingRight = '30px'; }
    }
}

function updateReaderContent() {
    if (!currentBook) return;
    const rc = document.getElementById('readerContent');
    const cp = document.getElementById('currentPage');
    if (rc) { rc.innerHTML = currentBook.pages[currentPage - 1]; rc.style.fontSize = fontSize + 'px'; rc.scrollTop = 0; }
    if (cp) cp.textContent = currentPage;
}

window.closeReader = function() {
    if (currentBook?.id) saveReadingProgress(currentBook.id, currentPage);
    if (isFullscreen) toggleFullscreen();
    const rw = document.getElementById('readerWindow');
    const ov = document.getElementById('overlay');
    const efb = document.getElementById('exitFullscreenBtn');
    const fp = document.getElementById('fullscreenPrevBtn');
    const fn = document.getElementById('fullscreenNextBtn');
    if (rw) rw.style.display = 'none';
    if (ov) ov.style.display = 'none';
    if (efb) efb.style.display = 'none';
    if (fp) fp.style.display = 'none';
    if (fn) fn.style.display = 'none';
}

window.loadAllBooks = loadAllBooksParallel;