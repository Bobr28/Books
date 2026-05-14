// Кэш для DOM элементов
const DOM = {};

// Инициализация DOM элементов (однократно)
function cacheDomElements() {
    const ids = ['booksGrid', 'loadingIndicator', 'errorMessage', 'readerWindow', 'overlay',
                 'readerTitle', 'readerContent', 'currentPage', 'totalPages', 'currentYear',
                 'themeToggle', 'closeReader', 'prevPage', 'nextPage',
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

// Настройки устройств (только для отступов и межстрочного интервала)
const DEVICE_CONFIG = {
    mobile: { lineHeight: 1.5, padding: 15 },
    tablet: { lineHeight: 1.6, padding: 25 },
    desktop: { lineHeight: 1.8, padding: 40 }
};

// Безопасная функция escapeHtml (исправлено: добавлена защита от кавычек)
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Применение стилей устройства (только padding и line-height, шрифт не трогаем)
function applyDeviceLayout() {
    if (!DOM.readerContent) return;
    const config = DEVICE_CONFIG[getDeviceType()];
    DOM.readerContent.style.lineHeight = config.lineHeight;
    DOM.readerContent.style.padding = config.padding + 'px';
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
let menuActive = false;

// ДЕФОЛТНЫЙ СПИСОК КНИГ
const DEFAULT_BOOK_FILES = [
    'book8.json', 'book7.json', 'book6.json', 'book5.json',
    'book4.json', 'book3.json', 'book2.json', 'book1.json'
];

// === ПОИСК КНИГ (ТОЛЬКО ПО НАЗВАНИЮ И АВТОРУ) ===
function addSearchBar() {
    const introSection = document.querySelector('.intro');
    if (!introSection) return;
    if (document.getElementById('globalSearchInput')) return;

    const searchHTML = `
        <div class="search-container">
            <input type="text" id="globalSearchInput" class="search-input"
                   placeholder="Поиск по названию или автору..."
                   autocomplete="off">
            <div id="globalSearchResults" class="search-results-dropdown" style="display: none;"></div>
        </div>
    `;

    introSection.insertAdjacentHTML('afterend', searchHTML);

    const searchInput = document.getElementById('globalSearchInput');
    const resultsDiv = document.getElementById('globalSearchResults');
    if (!searchInput) return;

    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 1) {
            resultsDiv.style.display = 'none';
            return;
        }
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div class="search-loading">🔍 Поиск...</div>';
        searchTimeout = setTimeout(() => performGlobalSearch(query), 400);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });

    function performGlobalSearch(query) {
        if (!allBooks || allBooks.length === 0) {
            resultsDiv.innerHTML = '<div class="search-no-results">📚 Книги ещё загружаются, попробуйте позже</div>';
            return;
        }
        const lowerQuery = query.toLowerCase();
        const results = [];
        for (const book of allBooks) {
            const titleMatch = book.title?.toLowerCase().includes(lowerQuery);
            const authorMatch = book.author?.toLowerCase().includes(lowerQuery);
            if (titleMatch || authorMatch) {
                let matchType = titleMatch ? '📖 в названии' : '✍️ у автора';
                results.push({
                    id: book.id,
                    title: book.title || 'Без названия',
                    author: book.author || 'Автор неизвестен',
                    matchType: matchType
                });
            }
        }
        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="search-no-results">Ничего не найдено</div>';
            return;
        }
        resultsDiv.innerHTML = `
            <div class="search-results-header">🔎 Найдено ${results.length} книг по запросу «${escapeHtml(query)}»</div>
            ${results.map(book => `
                <div class="search-result-item" data-book-id="${book.id}">
                    <div class="search-result-title">📖 ${escapeHtml(book.title)}</div>
                    <div class="search-result-author">✍️ ${escapeHtml(book.author)}</div>
                    <div class="search-result-match">${book.matchType}</div>
                </div>
            `).join('')}
        `;
        
        resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const bookId = parseInt(item.dataset.bookId);
                openBook(bookId);
                resultsDiv.style.display = 'none';
                searchInput.value = '';
            });
        });
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    cacheDomElements();
    if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();
    setupTheme();
    setupReader();
    setupSideMenu();
    updateConnectionStatus();

    const style = document.createElement('style');
    style.textContent = `
        .reader-content {
            transition: padding 0.2s ease, line-height 0.2s ease;
        }
    `;
    document.head.appendChild(style);

    await loadAllBooks();
    addSearchBar();
    registerServiceWorker();
});

// Регистрация Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                console.log('SW registered:', reg);
                setInterval(() => reg.update(), 60 * 60 * 1000);
            }).catch(err => console.error('SW registration failed:', err));
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'BOOKS_UPDATED') {
                console.log('Получено обновление книг, перезагружаем список');
                if (typeof loadAllBooks === 'function') {
                    loadAllBooks();
                }
            }
            if (event.data.type === 'REFRESH_PAGE') {
                window.location.reload();
            }
        });
    }
}

// Быстрая загрузка книг
async function loadAllBooks() {
    if (isLoading) return;
    isLoading = true;
    if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'block';
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';

    try {
        if (await loadFromCache()) {
            isLoading = false;
            if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
            if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
            return;
        }

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
            if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
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
                <p style="margin-top:15px;"><button id="retryButton" class="btn btn-read">🔄 Повторить</button></p>
            `;
            document.getElementById('retryButton')?.addEventListener('click', retryLoading);
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

// Отрисовка книг
function renderBooks(books) {
    if (!DOM.booksGrid) return;
    if (!books || books.length === 0) {
        DOM.booksGrid.innerHTML = '<div style="text-align:center;padding:40px;">📭 Книги не найдены</div>';
        return;
    }
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < books.length; i++) {
        const book = books[i];
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
        readBtn.addEventListener('click', () => openBook(book.id));
        detailsBtn.addEventListener('click', () => showBookDetails(book.id));
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
    currentPage = getReadingProgress(bookId);
    if (currentPage > currentBook.pages.length) currentPage = 1;

    const device = getDeviceType();
    fontSize = (device === 'mobile') ? 14 : (device === 'tablet') ? 16 : 18;

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

    applyDeviceLayout();
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

// ========== БОКОВОЕ МЕНЮ ==========
function setupSideMenu() {
    const burgerBtn = document.getElementById('burgerBtn');
    const sideMenu = document.getElementById('sideMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const sideMenuClose = document.getElementById('sideMenuClose');
    const menuGenres = document.getElementById('menuGenres');
    const menuAuthors = document.getElementById('menuAuthors');
    const menuAll = document.getElementById('menuAll');

    if (!burgerBtn || !sideMenu) return;

    // Открыть меню
    burgerBtn.addEventListener('click', () => {
        sideMenu.classList.add('active');
        menuOverlay.classList.add('active');
        menuActive = true;
        document.body.style.overflow = 'hidden';
    });

    // Закрыть меню
    function closeMenu() {
        sideMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        menuActive = false;
        document.body.style.overflow = '';
    }

    sideMenuClose.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuActive) {
            closeMenu();
        }
    });

    // Кнопки меню
    menuGenres.addEventListener('click', () => {
        closeMenu();
        showGenresModal();
    });

    menuAuthors.addEventListener('click', () => {
        closeMenu();
        showAuthorsModal();
    });

    menuAll.addEventListener('click', () => {
        closeMenu();
        renderBooks(allBooks);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ========== МОДАЛЬНОЕ ОКНО ЖАНРОВ ==========
function showGenresModal() {
    if (!allBooks || allBooks.length === 0) {
        alert('Книги ещё загружаются');
        return;
    }

    // Собираем жанры (если есть в данных книги)
    const genresMap = new Map();
    allBooks.forEach(book => {
        const genre = book.genre || 'Без жанра';
        if (!genresMap.has(genre)) {
            genresMap.set(genre, []);
        }
        genresMap.get(genre).push(book);
    });

    const modalHTML = `
        <div class="modal-overlay" id="genresModalOverlay"></div>
        <div class="modal active" id="genresModal">
            <div class="modal-header">
                <h3>📂 Жанры</h3>
                <button class="modal-close" id="closeGenresModal">✕</button>
            </div>
            <div class="modal-list">
                ${Array.from(genresMap.entries()).map(([genre, books]) => `
                    <button class="modal-list-item" data-genre="${escapeHtml(genre)}">
                        ${escapeHtml(genre)}
                        <span class="count">${books.length} кн.</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const overlay = document.getElementById('genresModalOverlay');
    const closeBtn = document.getElementById('closeGenresModal');
    const modal = document.getElementById('genresModal');

    function removeModal() {
        modal.remove();
        overlay.remove();
    }

    overlay.addEventListener('click', removeModal);
    closeBtn.addEventListener('click', removeModal);

    // Выбор жанра
    modal.querySelectorAll('.modal-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const genre = item.dataset.genre;
            const filtered = allBooks.filter(book => 
                (book.genre || 'Без жанра') === genre
            );
            renderBooks(filtered);
            removeModal();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// ========== МОДАЛЬНОЕ ОКНО АВТОРОВ ==========
function showAuthorsModal() {
    if (!allBooks || allBooks.length === 0) {
        alert('Книги ещё загружаются');
        return;
    }

    // Собираем авторов
    const authorsMap = new Map();
    allBooks.forEach(book => {
        const author = book.author || 'Неизвестный автор';
        if (!authorsMap.has(author)) {
            authorsMap.set(author, []);
        }
        authorsMap.get(author).push(book);
    });

    const modalHTML = `
        <div class="modal-overlay" id="authorsModalOverlay"></div>
        <div class="modal active" id="authorsModal">
            <div class="modal-header">
                <h3>✍️ Авторы</h3>
                <button class="modal-close" id="closeAuthorsModal">✕</button>
            </div>
            <div class="modal-list">
                ${Array.from(authorsMap.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([author, books]) => `
                    <button class="modal-list-item" data-author="${escapeHtml(author)}">
                        ${escapeHtml(author)}
                        <span class="count">${books.length} кн.</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const overlay = document.getElementById('authorsModalOverlay');
    const closeBtn = document.getElementById('closeAuthorsModal');
    const modal = document.getElementById('authorsModal');

    function removeModal() {
        modal.remove();
        overlay.remove();
    }

    overlay.addEventListener('click', removeModal);
    closeBtn.addEventListener('click', removeModal);

    // Выбор автора
    modal.querySelectorAll('.modal-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const author = item.dataset.author;
            const filtered = allBooks.filter(book => 
                (book.author || 'Неизвестный автор') === author
            );
            renderBooks(filtered);
            removeModal();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// Настройка темы (ОДНА КНОПКА)
function setupTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    document.body.classList.add(savedTheme + '-theme');
    
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    // Показываем правильную иконку при загрузке
    updateThemeIcon(savedTheme);
    
    themeToggle.addEventListener('click', () => {
        if (document.body.classList.contains('light-theme')) {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            localStorage.setItem('selectedTheme', 'dark');
            updateThemeIcon('dark');
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('selectedTheme', 'light');
            updateThemeIcon('light');
        }
    });
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const lightIcon = themeToggle.querySelector('.theme-icon-light');
    const darkIcon = themeToggle.querySelector('.theme-icon-dark');
    
    if (theme === 'dark') {
        lightIcon.style.display = 'none';
        darkIcon.style.display = 'inline';
    } else {
        lightIcon.style.display = 'inline';
        darkIcon.style.display = 'none';
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

    if (DOM.prevPage) DOM.prevPage.addEventListener('click', prevPage);
    if (DOM.nextPage) DOM.nextPage.addEventListener('click', nextPage);
    if (DOM.fullscreenPrevBtn) DOM.fullscreenPrevBtn.addEventListener('click', prevPage);
    if (DOM.fullscreenNextBtn) DOM.fullscreenNextBtn.addEventListener('click', nextPage);
    if (DOM.closeReader) DOM.closeReader.addEventListener('click', closeReader);
    if (DOM.overlay) DOM.overlay.addEventListener('click', closeReader);
    if (DOM.exitFullscreenBtn) DOM.exitFullscreenBtn.addEventListener('click', toggleFullscreen);
    if (DOM.fullscreenBtn) DOM.fullscreenBtn.addEventListener('click', toggleFullscreen);

    if (DOM.fontPlus) {
        DOM.fontPlus.addEventListener('click', function() {
            fontSize = Math.min(fontSize + 2, 30);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        });
    }
    if (DOM.fontMinus) {
        DOM.fontMinus.addEventListener('click', function() {
            fontSize = Math.max(fontSize - 2, 14);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        });
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
        } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            fontSize = Math.min(fontSize + 2, 30);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        } else if (e.key === '-' || e.key === '_') {
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
        if (DOM.overlay) DOM.overlay.style.display = 'none';
        isFullscreen = true;
    } else {
        DOM.readerWindow.classList.remove('fullscreen');
        if (DOM.overlay) DOM.overlay.style.display = 'block';
        isFullscreen = false;
        applyDeviceLayout();
    }
};

window.closeReader = function() {
    if (currentBook && currentBook.id) saveReadingProgress(currentBook.id, currentPage);
    if (isFullscreen) toggleFullscreen();
    if (DOM.readerWindow) DOM.readerWindow.style.display = 'none';
    if (DOM.overlay) DOM.overlay.style.display = 'none';
};

window.retryLoading = function() {
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
    localStorage.removeItem('cachedBooks');
    localStorage.removeItem('cacheTimestamp');
    allBooks = [];
    loadAllBooks();
};

function updateConnectionStatus() {
    let statusDiv = document.getElementById('connection-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'connection-status';
        statusDiv.style.cssText = 'position:fixed;bottom:80px;right:16px;padding:6px 12px;border-radius:20px;font-size:12px;z-index:1000;background:rgba(0,0,0,0.7);color:white;pointer-events:none;';
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
            applyDeviceLayout();
            if (currentPage > currentBook.pages.length) {
                currentPage = currentBook.pages.length;
                updateReaderContent();
                saveReadingProgress(currentBook.id, currentPage);
            }
        }
    }, 150);
});

window.loadAllBooks = loadAllBooks;
