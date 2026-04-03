// Кэш для DOM элементов
const DOM = {};

// Инициализация DOM элементов (однократно)
function cacheDomElements() {
    const ids = ['booksGrid', 'loadingIndicator', 'errorMessage', 'readerWindow', 'overlay', 
                 'readerTitle', 'readerContent', 'currentPage', 'totalPages', 'currentYear',
                 'themeLight', 'themeDark', 'closeReader', 'prevPage', 'nextPage', 
                 'fontPlus', 'fontMinus', 'fullscreenBtn', 'exitFullscreenBtn',
                 'fullscreenPrevBtn', 'fullscreenNextBtn'];
    
    ids.forEach(id => {
        DOM[id] = document.getElementById(id);
    });
}

// Определение устройства (кэшируется)
let cachedDeviceType = null;
let cachedWidth = 0;

function getDeviceType() {
    const width = window.innerWidth;
    if (width === cachedWidth && cachedDeviceType) return cachedDeviceType;
    
    cachedWidth = width;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (width <= 480 || (isMobile && width <= 768)) cachedDeviceType = 'mobile';
    else if (width <= 768) cachedDeviceType = 'tablet';
    else cachedDeviceType = 'desktop';
    
    return cachedDeviceType;
}

// Настройки устройств
const DEVICE_CONFIG = {
    mobile: { charsPerPage: 800, fontSize: 14, lineHeight: 1.5, padding: 15 },
    tablet: { charsPerPage: 1200, fontSize: 16, lineHeight: 1.6, padding: 25 },
    desktop: { charsPerPage: 1800, fontSize: 18, lineHeight: 1.8, padding: 40 }
};

// Быстрое разбиение на страницы
function splitHtmlIntoPages(htmlContent, charsPerPage) {
    if (!htmlContent || typeof htmlContent !== 'string') return [''];
    if (htmlContent.length <= charsPerPage) return [htmlContent];
    
    const cleanText = htmlContent.replace(/\s+/g, ' ');
    const totalChars = cleanText.length;
    
    if (totalChars <= charsPerPage) return [htmlContent];
    
    const pages = [];
    let start = 0;
    
    while (start < totalChars) {
        let end = start + charsPerPage;
        if (end >= totalChars) {
            pages.push(cleanText.substring(start));
            break;
        }
        
        while (end > start && cleanText[end] !== ' ') end--;
        if (end === start) end = start + charsPerPage;
        
        pages.push(cleanText.substring(start, end));
        start = end;
    }
    
    return pages;
}

// БЕЗОПАСНАЯ функция escapeHtml (исправлена)
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Применение стилей устройства
function applyDeviceStyles() {
    const config = DEVICE_CONFIG[getDeviceType()];
    if (DOM.readerContent) {
        DOM.readerContent.style.fontSize = config.fontSize + 'px';
        DOM.readerContent.style.lineHeight = config.lineHeight;
        DOM.readerContent.style.padding = config.padding + 'px';
    }
}

// Сохранение прогресса
function saveReadingProgress(bookId, page) {
    if (!bookId) return;
    try {
        const progress = JSON.parse(localStorage.getItem('readingProgress') || '{}');
        if (progress[bookId] !== page) {
            progress[bookId] = page;
            localStorage.setItem('readingProgress', JSON.stringify(progress));
        }
    } catch(e) {}
}

function getReadingProgress(bookId) {
    if (!bookId) return 1;
    try {
        const progress = JSON.parse(localStorage.getItem('readingProgress') || '{}');
        return progress[bookId] || 1;
    } catch(e) { return 1; }
}

// Глобальные переменные
let allBooks = [];
let currentBook = null;
let currentPage = 1;
let fontSize = 18;
let isFullscreen = false;
let isLoading = false;

// ДЕФОЛТНЫЙ СПИСОК КНИГ
const DEFAULT_BOOK_FILES = [
    'book1.json', 'book2.json', 'book3.json', 'book4.json', 
    'book5.json', 'book6.json', 'book7.json', 'book8.json'
];

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    cacheDomElements();
    
    if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();
    
    setupTheme();
    setupReader();
    updateConnectionStatus();
    
    // Добавляем CSS
    const style = document.createElement('style');
    style.textContent = `:root{--reader-font-size:18px;--reader-line-height:1.8;--reader-padding:40px}.reader-content{font-size:var(--reader-font-size);line-height:var(--reader-line-height);padding:var(--reader-padding)}@media(max-width:768px){.page-nav-btn{width:40px;height:40px}.reader-btn{padding:8px 12px}.font-btn,.fullscreen-btn{width:35px;height:35px}}`;
    document.head.appendChild(style);
    
    await loadAllBooks();
});

// Быстрая загрузка книг
async function loadAllBooks() {
    if (isLoading) return;
    isLoading = true;
    
    if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'block';
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
    if (DOM.booksGrid) DOM.booksGrid.innerHTML = '<div style="text-align:center;padding:40px;">📚 Загрузка книг...</div>';
    
    try {
        // 1. Сначала пытаемся загрузить из кэша
        if (await loadFromCache()) {
            isLoading = false;
            if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
            return;
        }
        
        // 2. Пытаемся загрузить список файлов
        let bookFiles = [];
        let listLoaded = false;
        
        try {
            const response = await fetch('books-list.json?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    bookFiles = data;
                    listLoaded = true;
                    console.log('✅ Загружен books-list.json:', bookFiles);
                }
            }
        } catch(e) {
            console.warn('⚠️ Не удалось загрузить books-list.json');
        }
        
        if (!listLoaded || bookFiles.length === 0) {
            bookFiles = DEFAULT_BOOK_FILES;
            console.log('📚 Используем список по умолчанию');
        }
        
        // 3. Загружаем книги последовательно (чтобы не перегружать)
        allBooks = [];
        
        for (let i = 0; i < bookFiles.length; i++) {
            const filename = bookFiles[i];
            try {
                const res = await fetch(filename + '?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.title && data.author && data.pages && Array.isArray(data.pages)) {
                        data.id = i + 1;
                        allBooks.push(data);
                        console.log(`✅ Загружена: ${data.title}`);
                    } else {
                        console.warn(`⚠️ Неверный формат: ${filename}`);
                    }
                } else {
                    console.warn(`⚠️ Не найдена: ${filename} (${res.status})`);
                }
            } catch(e) {
                console.warn(`⚠️ Ошибка: ${filename}`, e.message);
            }
        }
        
        console.log(`📊 Загружено книг: ${allBooks.length}`);
        
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            
            // Сохраняем в кэш
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
            } catch(e) {}
        } else {
            throw new Error('Не удалось загрузить ни одной книги');
        }
        
    } catch(error) {
        console.error('❌ Ошибка:', error);
        
        const cacheLoaded = await loadFromCache();
        
        if (!cacheLoaded && DOM.errorMessage) {
            DOM.errorMessage.style.display = 'block';
            DOM.errorMessage.innerHTML = `
                <h3>❌ Ошибка загрузки книг</h3>
                <p>Не удалось загрузить книги. Проверьте:</p>
                <ul style="text-align:left;display:inline-block;margin:10px 0;">
                    <li>Файл books-list.json в корне сайта</li>
                    <li>Файлы book1.json...book8.json в корне</li>
                </ul>
                <p style="margin-top:15px;">
                    <button onclick="retryLoading()" class="btn btn-read">🔄 Повторить</button>
                </p>
            `;
        }
    } finally {
        isLoading = false;
        if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
    }
}

// Загрузка из кэша
async function loadFromCache() {
    try {
        const cached = localStorage.getItem('cachedBooks');
        const timestamp = localStorage.getItem('cacheTimestamp');
        
        if (cached && timestamp && (Date.now() - parseInt(timestamp) < 86400000)) {
            allBooks = JSON.parse(cached);
            if (allBooks && allBooks.length > 0) {
                renderBooks(allBooks);
                console.log(`⚡ Из кэша: ${allBooks.length} книг`);
                return true;
            }
        }
    } catch(e) {
        console.warn('Ошибка чтения кэша:', e);
    }
    return false;
}

// Отрисовка книг (исправлена)
function renderBooks(books) {
    if (!DOM.booksGrid) return;
    if (!books || books.length === 0) {
        DOM.booksGrid.innerHTML = '<div style="text-align:center;padding:40px;">📭 Книги не найдены</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        
        // Безопасное получение значений
        const cover = escapeHtml(book.cover || book.title || 'Книга');
        const title = escapeHtml(book.title || 'Без названия');
        const author = escapeHtml(book.author || 'Неизвестен');
        const year = escapeHtml(book.year || 'Не указан');
        const pagesCount = (book.pages && Array.isArray(book.pages)) ? book.pages.length : 0;
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.setAttribute('data-id', book.id);
        card.innerHTML = `
            <div class="book-cover">${cover}</div>
            <div class="book-title">${title}</div>
            <div class="book-meta">
                <p><strong>Автор:</strong> ${author}</p>
                <p><strong>Год:</strong> ${year}</p>
                <p><strong>Страниц:</strong> ${pagesCount}</p>
            </div>
            <div class="book-buttons">
                <button class="btn btn-read">📖 Читать</button>
                <button class="btn btn-details">ℹ️ Подробнее</button>
            </div>
        `;
        
        const readBtn = card.querySelector('.btn-read');
        const detailsBtn = card.querySelector('.btn-details');
        
        readBtn.onclick = (function(b) { return function() { openBook(b.id); }; })(book);
        detailsBtn.onclick = (function(b) { return function() { showBookDetails(b.id); }; })(book);
        
        fragment.appendChild(card);
    }
    
    DOM.booksGrid.innerHTML = '';
    DOM.booksGrid.appendChild(fragment);
}

// Открытие книги
window.openBook = function(bookId) {
    const book = allBooks.find(function(b) { return b.id === bookId; });
    if (!book || !book.pages || !book.pages.length) {
        alert('Ошибка: книга не найдена');
        return;
    }
    
    currentBook = JSON.parse(JSON.stringify(book));
    
    if (!currentBook.originalPages) {
        currentBook.originalPages = currentBook.pages.slice();
    }
    
    const device = getDeviceType();
    const config = DEVICE_CONFIG[device];
    
    const newPages = [];
    for (var i = 0; i < currentBook.originalPages.length; i++) {
        var split = splitHtmlIntoPages(currentBook.originalPages[i], config.charsPerPage);
        for (var j = 0; j < split.length; j++) {
            newPages.push(split[j]);
        }
    }
    currentBook.pages = newPages;
    
    currentPage = getReadingProgress(bookId);
    if (currentPage > currentBook.pages.length) currentPage = 1;
    
    if (DOM.readerTitle) DOM.readerTitle.textContent = currentBook.title;
    if (DOM.readerContent) {
        DOM.readerContent.innerHTML = currentBook.pages[currentPage - 1];
        DOM.readerContent.style.fontSize = fontSize + 'px';
        DOM.readerContent.scrollTop = 0;
    }
    if (DOM.currentPage) DOM.currentPage.textContent = currentPage;
    if (DOM.totalPages) DOM.totalPages.textContent = currentBook.pages.length;
    if (DOM.readerWindow) DOM.readerWindow.style.display = 'flex';
    if (DOM.overlay) DOM.overlay.style.display = 'block';
    
    applyDeviceStyles();
};

function showBookDetails(bookId) {
    const book = allBooks.find(function(b) { return b.id === bookId; });
    if (!book) return;
    
    let preview = '';
    if (book.pages && book.pages[0]) {
        preview = book.pages[0].replace(/<[^>]*>/g, '').substring(0, 150);
    }
    
    alert(book.title + '\n\nАвтор: ' + book.author + '\nГод: ' + (book.year || 'Не указан') + '\nСтраниц: ' + (book.pages ? book.pages.length : 0) + '\n\n' + preview + '...');
}

// Настройка темы
function setupTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    document.body.classList.add(savedTheme + '-theme');
    
    const themeLight = document.getElementById('theme-light');
    const themeDark = document.getElementById('theme-dark');
    
    if (themeLight) {
        themeLight.onclick = function() {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('selectedTheme', 'light');
            themeLight.classList.add('active');
            if (themeDark) themeDark.classList.remove('active');
        };
        if (savedTheme === 'light') themeLight.classList.add('active');
    }
    
    if (themeDark) {
        themeDark.onclick = function() {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            localStorage.setItem('selectedTheme', 'dark');
            themeDark.classList.add('active');
            if (themeLight) themeLight.classList.remove('active');
        };
        if (savedTheme === 'dark') themeDark.classList.add('active');
    }
}

// Настройка читалки
function setupReader() {
    const prevPage = function() {
        if (currentBook && currentPage > 1) {
            currentPage--;
            updateReaderContent();
            saveReadingProgress(currentBook.id, currentPage);
        }
    };
    
    const nextPage = function() {
        if (currentBook && currentPage < currentBook.pages.length) {
            currentPage++;
            updateReaderContent();
            saveReadingProgress(currentBook.id, currentPage);
        }
    };
    
    if (DOM.prevPage) DOM.prevPage.onclick = prevPage;
    if (DOM.nextPage) DOM.nextPage.onclick = nextPage;
    if (DOM.fullscreenPrevBtn) DOM.fullscreenPrevBtn.onclick = prevPage;
    if (DOM.fullscreenNextBtn) DOM.fullscreenNextBtn.onclick = nextPage;
    if (DOM.closeReader) DOM.closeReader.onclick = closeReader;
    if (DOM.overlay) DOM.overlay.onclick = closeReader;
    if (DOM.exitFullscreenBtn) DOM.exitFullscreenBtn.onclick = toggleFullscreen;
    if (DOM.fullscreenBtn) DOM.fullscreenBtn.onclick = toggleFullscreen;
    
    if (DOM.fontPlus) {
        DOM.fontPlus.onclick = function() {
            fontSize = Math.min(fontSize + 2, 30);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        };
    }
    
    if (DOM.fontMinus) {
        DOM.fontMinus.onclick = function() {
            fontSize = Math.max(fontSize - 2, 14);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        };
    }
    
    document.addEventListener('keydown', function(e) {
        if (DOM.readerWindow && DOM.readerWindow.style.display !== 'flex') return;
        
        if (e.key === 'Escape') {
            if (isFullscreen) toggleFullscreen();
            else closeReader();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            prevPage();
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            nextPage();
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.key === '+') {
            e.preventDefault();
            fontSize = Math.min(fontSize + 2, 30);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        } else if (e.key === '-') {
            e.preventDefault();
            fontSize = Math.max(fontSize - 2, 14);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        }
    });
}

function updateReaderContent() {
    if (!currentBook || !DOM.readerContent) return;
    DOM.readerContent.innerHTML = currentBook.pages[currentPage - 1];
    DOM.readerContent.style.fontSize = fontSize + 'px';
    DOM.readerContent.scrollTop = 0;
    if (DOM.currentPage) DOM.currentPage.textContent = currentPage;
}

window.toggleFullscreen = function() {
    if (!DOM.readerWindow) return;
    
    if (!isFullscreen) {
        DOM.readerWindow.classList.add('fullscreen');
        if (DOM.exitFullscreenBtn) DOM.exitFullscreenBtn.style.display = 'flex';
        if (DOM.fullscreenPrevBtn) DOM.fullscreenPrevBtn.style.display = 'flex';
        if (DOM.fullscreenNextBtn) DOM.fullscreenNextBtn.style.display = 'flex';
        if (DOM.overlay) DOM.overlay.style.display = 'none';
        isFullscreen = true;
        if (DOM.readerContent) {
            DOM.readerContent.style.paddingLeft = '50px';
            DOM.readerContent.style.paddingRight = '50px';
        }
    } else {
        DOM.readerWindow.classList.remove('fullscreen');
        if (DOM.exitFullscreenBtn) DOM.exitFullscreenBtn.style.display = 'none';
        if (DOM.fullscreenPrevBtn) DOM.fullscreenPrevBtn.style.display = 'none';
        if (DOM.fullscreenNextBtn) DOM.fullscreenNextBtn.style.display = 'none';
        if (DOM.overlay) DOM.overlay.style.display = 'block';
        isFullscreen = false;
        if (DOM.readerContent) {
            DOM.readerContent.style.paddingLeft = '30px';
            DOM.readerContent.style.paddingRight = '30px';
        }
    }
};

window.closeReader = function() {
    if (currentBook && currentBook.id) saveReadingProgress(currentBook.id, currentPage);
    if (isFullscreen) toggleFullscreen();
    if (DOM.readerWindow) DOM.readerWindow.style.display = 'none';
    if (DOM.overlay) DOM.overlay.style.display = 'none';
    if (DOM.exitFullscreenBtn) DOM.exitFullscreenBtn.style.display = 'none';
    if (DOM.fullscreenPrevBtn) DOM.fullscreenPrevBtn.style.display = 'none';
    if (DOM.fullscreenNextBtn) DOM.fullscreenNextBtn.style.display = 'none';
};

window.retryLoading = function() {
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
    localStorage.removeItem('cachedBooks');
    localStorage.removeItem('cacheTimestamp');
    allBooks = [];
    loadAllBooks();
};

// Статус подключения
function updateConnectionStatus() {
    let statusDiv = document.getElementById('connection-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'connection-status';
        statusDiv.style.cssText = 'position:fixed;bottom:16px;right:16px;padding:6px 12px;border-radius:20px;font-size:12px;z-index:1000;background:rgba(0,0,0,0.7);color:white;pointer-events:none;';
        document.body.appendChild(statusDiv);
    }
    statusDiv.textContent = navigator.onLine ? '● Онлайн' : '○ Офлайн';
    statusDiv.style.background = navigator.onLine ? 'rgba(46,125,50,0.9)' : 'rgba(128,128,128,0.9)';
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        cachedDeviceType = null;
        if (currentBook && DOM.readerWindow && DOM.readerWindow.style.display === 'flex') {
            const oldPage = currentPage;
            const config = DEVICE_CONFIG[getDeviceType()];
            
            const newPages = [];
            for (var i = 0; i < currentBook.originalPages.length; i++) {
                var split = splitHtmlIntoPages(currentBook.originalPages[i], config.charsPerPage);
                for (var j = 0; j < split.length; j++) newPages.push(split[j]);
            }
            currentBook.pages = newPages;
            
            currentPage = Math.min(oldPage, currentBook.pages.length);
            updateReaderContent();
            if (DOM.totalPages) DOM.totalPages.textContent = currentBook.pages.length;
            saveReadingProgress(currentBook.id, currentPage);
            applyDeviceStyles();
        }
    // === ПОИСК КНИГ (ДОБАВИТЬ В КОНЕЦ script.js) ===

// Добавляем поле поиска на страницу
function addSearchFeature() {
    // Находим место для поиска (после intro, перед коллекцией книг)
    const introSection = document.querySelector('.intro');
    if (!introSection) return;
    
    // Проверяем, нет ли уже поиска
    if (document.getElementById('globalSearchInput')) return;
    
    const searchHTML = `
        <div class="search-container" style="margin: 25px 0 30px 0; position: relative;">
            <input type="text" id="globalSearchInput" class="search-input" 
                   placeholder="🔍 Быстрый поиск по названию, автору или тексту книги..." 
                   autocomplete="off"
                   style="width: 100%; padding: 14px 20px; font-size: 16px; border: 2px solid #e0e0e0; border-radius: 12px; background: var(--bg-color, white); transition: all 0.3s;">
            <div id="globalSearchResults" class="search-results-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border-radius: 12px; margin-top: 8px; max-height: 400px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.15);"></div>
        </div>
    `;
    
    introSection.insertAdjacentHTML('afterend', searchHTML);
    
    // Применяем стили для тёмной темы
    const style = document.createElement('style');
    style.textContent = `
        .dark-theme .search-input {
            background: #2d2d2d;
            color: #e0e0e0;
            border-color: #444;
        }
        .dark-theme .search-results-dropdown {
            background: #2d2d2d;
            border-color: #444;
        }
        .search-result-item {
            padding: 14px 16px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background 0.2s;
        }
        .search-result-item:hover {
            background: #f5f5f5;
        }
        .dark-theme .search-result-item {
            border-color: #3a3a3a;
        }
        .dark-theme .search-result-item:hover {
            background: #383838;
        }
        .search-result-title {
            font-weight: bold;
            font-size: 15px;
            margin-bottom: 4px;
        }
        .search-result-author {
            font-size: 13px;
            color: #666;
            margin-bottom: 4px;
        }
        .dark-theme .search-result-author {
            color: #aaa;
        }
        .search-result-match {
            font-size: 11px;
            color: #4CAF50;
            margin-bottom: 6px;
        }
        .search-result-preview {
            font-size: 12px;
            color: #888;
            font-style: italic;
            line-height: 1.4;
        }
        .dark-theme .search-result-preview {
            color: #aaa;
        }
        .search-loading, .search-no-results {
            padding: 20px;
            text-align: center;
            color: #666;
        }
        .search-results-header {
            padding: 12px 16px;
            background: #f5f5f5;
            font-size: 13px;
            color: #666;
            border-bottom: 1px solid #e0e0e0;
        }
        .dark-theme .search-results-header {
            background: #252525;
            color: #aaa;
            border-color: #444;
        }
    `;
    document.head.appendChild(style);
    
    // Настройка поиска
    const searchInput = document.getElementById('globalSearchInput');
    const resultsDiv = document.getElementById('globalSearchResults');
    
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }
        
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div class="search-loading">🔍 Поиск...</div>';
        
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 400);
    });
    
    // Скрываем результаты при клике вне
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
    
    function performSearch(query) {
        if (!allBooks || allBooks.length === 0) {
            resultsDiv.innerHTML = '<div class="search-no-results">📚 Книги ещё загружаются, попробуйте позже</div>';
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        const results = [];
        
        for (const book of allBooks) {
            const titleMatch = book.title?.toLowerCase().includes(lowerQuery);
            const authorMatch = book.author?.toLowerCase().includes(lowerQuery);
            
            let textMatch = false;
            let preview = '';
            
            // Поиск по тексту (только если книга загружена)
            if (book.pages && book.pages.length) {
                const fullText = book.pages.join(' ').toLowerCase();
                textMatch = fullText.includes(lowerQuery);
                
                if (textMatch && !titleMatch && !authorMatch) {
                    const index = fullText.indexOf(lowerQuery);
                    const start = Math.max(0, index - 50);
                    const end = Math.min(fullText.length, index + 70);
                    preview = fullText.substring(start, end).replace(/<[^>]*>/g, ' ').trim();
                    if (start > 0) preview = '...' + preview;
                    if (end < fullText.length) preview = preview + '...';
                }
            }
            
            if (titleMatch || authorMatch || textMatch) {
                let matchType = '';
                if (titleMatch) matchType = '📖 в названии';
                else if (authorMatch) matchType = '✍️ у автора';
                else matchType = '📄 в тексте';
                
                results.push({
                    id: book.id,
                    title: book.title || 'Без названия',
                    author: book.author || 'Автор неизвестен',
                    matchType: matchType,
                    preview: preview
                });
            }
        }
        
        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="search-no-results">😔 Ничего не найдено</div>';
            return;
        }
        
        resultsDiv.innerHTML = `
            <div class="search-results-header">🔎 Найдено ${results.length} книг по запросу «${escapeHtml(query)}»</div>
            ${results.map(book => `
                <div class="search-result-item" onclick="openBook(${book.id})">
                    <div class="search-result-title">📖 ${escapeHtml(book.title)}</div>
                    <div class="search-result-author">✍️ ${escapeHtml(book.author)}</div>
                    <div class="search-result-match">${book.matchType}</div>
                    ${book.preview ? `<div class="search-result-preview">${escapeHtml(book.preview)}</div>` : ''}
                </div>
            `).join('')}
        `;
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Запускаем добавление поиска после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(addSearchFeature, 500);
    });
} else {
    setTimeout(addSearchFeature, 500);
}
    }, 150);
});

window.loadAllBooks = loadAllBooks;
