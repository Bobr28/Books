// ========== ОФЛАЙН-СИНХРОНИЗАЦИЯ ==========

let isLoading = false;
let loadStartTime = 0;
let loadingElement = null;

// Создаем индикатор загрузки
function showLoading() {
    if (loadingElement) return;
    
    loadingElement = document.createElement('div');
    loadingElement.className = 'custom-loading';
    loadingElement.innerHTML = `
        <div class="spinner"></div>
        <p>Загрузка книг...</p>
    `;
    
    const booksGrid = document.getElementById('booksGrid');
    if (booksGrid && booksGrid.parentNode) {
        booksGrid.parentNode.insertBefore(loadingElement, booksGrid);
    }
}

function hideLoading() {
    if (loadingElement && loadingElement.parentNode) {
        loadingElement.parentNode.removeChild(loadingElement);
        loadingElement = null;
    }
}

// Статус подключения
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
    
    statusDiv.textContent = navigator.onLine ? '● Онлайн' : '○ Офлайн';
    statusDiv.style.background = navigator.onLine ? 'rgba(46, 125, 50, 0.9)' : 'rgba(198, 40, 40, 0.9)';
}

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
}

window.addEventListener('online', () => {
    updateConnectionStatus();
    if (typeof window.loadAllBooks === 'function' && !isLoading) {
        window.loadAllBooks();
    }
});

window.addEventListener('offline', updateConnectionStatus);

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

// ========== АНТИВОР СИСТЕМА ==========

(function() {
    const ALLOWED_DOMAINS = ['rafstar.vercel.app', 'localhost', '127.0.0.1'];
    const currentDomain = window.location.hostname.toLowerCase();
    const isAllowed = ALLOWED_DOMAINS.some(domain => currentDomain === domain.toLowerCase());
    
    if (!isAllowed && !window.location.search.includes('antitheft_key=allow-dev-123')) {
        document.body.innerHTML = '';
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: red; color: white; font-size: 48px;
            display: flex; align-items: center; justify-content: center;
            z-index: 999999; text-align: center; flex-direction: column;
        `;
        overlay.innerHTML = `
            <div>🚨 Это не оригинальный сайт 🚨</div>
            <div style="font-size: 24px; margin-top: 20px;">Владелец: rafstar</div>
        `;
        document.body.appendChild(overlay);
        
        document.addEventListener('keydown', e => { e.preventDefault(); e.stopPropagation(); });
        document.addEventListener('contextmenu', e => e.preventDefault());
        throw new Error('Access denied');
    }
})();

// ========== ЛОГИКА БИБЛИОТЕКИ ==========

let BOOKS_CONFIG = [];
let allBooks = [];
let currentBook = null;
let currentPage = 1;
let fontSize = 18;
let isFullscreen = false;

const bookCache = new Map();

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    loadStartTime = performance.now();
    
    const yearElement = document.getElementById('currentYear');
    if (yearElement) yearElement.textContent = new Date().getFullYear();
    
    setupThemeSwitcher();
    loadSavedTheme();
    setupReader();
    updateConnectionStatus();
    
    await loadFromCache();
    setTimeout(() => loadBooksList(), 100);
});

// Загрузка из кэша
async function loadFromCache() {
    try {
        const cachedBooks = localStorage.getItem('cachedBooks');
        if (cachedBooks) {
            allBooks = JSON.parse(cachedBooks);
            if (allBooks.length > 0) {
                renderBooks(allBooks);
                console.log(`✅ Загружено из кэша: ${allBooks.length} книг`);
                return true;
            }
        }
    } catch (e) {}
    return false;
}

// Загрузка списка книг
async function loadBooksList() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        const cacheLoaded = allBooks.length > 0;
        if (!cacheLoaded) showLoading();
        
        let response;
        try {
            response = await fetch('books-list.json');
        } catch (e) {
            if (!cacheLoaded) {
                BOOKS_CONFIG = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, filename: `book${i + 1}.json` }));
                await loadAllBooks();
            }
            isLoading = false;
            return;
        }
        
        if (response.ok) {
            const bookFiles = await response.json();
            if (Array.isArray(bookFiles) && bookFiles.length > 0) {
                BOOKS_CONFIG = bookFiles.map((filename, index) => ({ id: index + 1, filename }));
            }
        } else if (!cacheLoaded) {
            BOOKS_CONFIG = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, filename: `book${i + 1}.json` }));
        }
        
        await loadAllBooks();
        
    } catch (error) {
        console.error('Ошибка:', error);
        if (allBooks.length === 0) {
            const errorDiv = document.getElementById('errorMessage');
            if (errorDiv) {
                errorDiv.style.display = 'block';
                errorDiv.innerHTML = `
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить книги. Проверьте подключение.</p>
                    <button onclick="window.retryLoading()">Повторить</button>
                `;
            }
        }
    } finally {
        isLoading = false;
        hideLoading();
    }
}

// Параллельная загрузка всех книг
async function loadAllBooks() {
    try {
        const promises = BOOKS_CONFIG.map(async (config) => {
            if (bookCache.has(config.filename)) return bookCache.get(config.filename);
            
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
                
                if (!bookData.title || !bookData.author || !bookData.pages) return null;
                
                bookData.id = config.id;
                bookCache.set(config.filename, bookData);
                return bookData;
            } catch (error) {
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const newBooks = results.filter(book => book !== null);
        
        if (newBooks.length > 0) {
            allBooks = newBooks;
            renderBooks(allBooks);
            
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
                console.log(`✅ Загружено ${allBooks.length} книг`);
            } catch (e) {}
        }
    } catch (error) {
        console.error('Ошибка загрузки книг:', error);
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

// Отображение книг
function renderBooks(books) {
    const booksGrid = document.getElementById('booksGrid');
    if (!booksGrid) return;
    
    const fragment = document.createDocumentFragment();
    
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
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
        fragment.appendChild(card);
    });
    
    booksGrid.innerHTML = '';
    booksGrid.appendChild(fragment);
    
    booksGrid.addEventListener('click', (e) => {
        const readBtn = e.target.closest('.btn-read');
        const detailsBtn = e.target.closest('.btn-details');
        
        if (readBtn) {
            const bookId = parseInt(readBtn.dataset.id);
            openBook(bookId);
        } else if (detailsBtn) {
            const bookId = parseInt(detailsBtn.dataset.id);
            showBookDetails(bookId);
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
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
};

function showBookDetails(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    const preview = book.pages?.[0]?.replace(/<[^>]*>/g, '').substring(0, 150) || '';
    alert(`${book.title}\n\nАвтор: ${book.author}\nГод: ${book.year || 'Не указан'}\nСтраниц: ${book.pages?.length || 0}\n\n${preview}...`);
}

function setupThemeSwitcher() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.id.replace('theme-', '');
            switchTheme(theme);
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
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
    const closeBtn = document.getElementById('closeReader');
    const overlay = document.getElementById('overlay');
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
    
    if (prevBtn) prevBtn.onclick = () => { if (currentBook && currentPage > 1) { currentPage--; updateReader(); saveReadingProgress(currentBook.id, currentPage); } };
    if (nextBtn) nextBtn.onclick = () => { if (currentBook && currentPage < currentBook.pages.length) { currentPage++; updateReader(); saveReadingProgress(currentBook.id, currentPage); } };
    if (fullscreenPrevBtn) fullscreenPrevBtn.onclick = () => { if (currentBook && currentPage > 1) { currentPage--; updateReader(); saveReadingProgress(currentBook.id, currentPage); } };
    if (fullscreenNextBtn) fullscreenNextBtn.onclick = () => { if (currentBook && currentPage < currentBook.pages.length) { currentPage++; updateReader(); saveReadingProgress(currentBook.id, currentPage); } };
    
    if (fontPlus) fontPlus.onclick = () => { fontSize = Math.min(fontSize + 2, 30); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; };
    if (fontMinus) fontMinus.onclick = () => { fontSize = Math.max(fontSize - 2, 14); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; };
    if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;
    
    document.addEventListener('keydown', (e) => {
        const readerWindow = document.getElementById('readerWindow');
        if (readerWindow?.style.display !== 'flex') return;
        if (e.key === 'Escape') { if (isFullscreen) toggleFullscreen(); else closeReader(); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (currentBook && currentPage > 1) { currentPage--; updateReader(); saveReadingProgress(currentBook.id, currentPage); } }
        else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); if (currentBook && currentPage < currentBook.pages.length) { currentPage++; updateReader(); saveReadingProgress(currentBook.id, currentPage); } }
        else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
        else if (e.key === '+') { e.preventDefault(); fontSize = Math.min(fontSize + 2, 30); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; }
        else if (e.key === '-') { e.preventDefault(); fontSize = Math.max(fontSize - 2, 14); const rc = document.getElementById('readerContent'); if (rc) rc.style.fontSize = fontSize + 'px'; }
    });
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
        if (fb) fb.innerHTML = '✕';
        if (efb) efb.style.display = 'flex';
        if (fp) fp.style.display = 'flex';
        if (fn) fn.style.display = 'flex';
        if (ov) ov.style.display = 'none';
        isFullscreen = true;
        if (rc) { rc.style.paddingLeft = '50px'; rc.style.paddingRight = '50px'; }
    } else {
        rw.classList.remove('fullscreen');
        if (fb) fb.innerHTML = '⛶';
        if (efb) efb.style.display = 'none';
        if (fp) fp.style.display = 'none';
        if (fn) fn.style.display = 'none';
        if (ov) ov.style.display = 'block';
        isFullscreen = false;
        if (rc) { rc.style.paddingLeft = '30px'; rc.style.paddingRight = '30px'; }
    }
};

function updateReader() {
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
};

window.loadAllBooks = loadAllBooks;