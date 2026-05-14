// Кэш для DOM элементов
const DOM = {};

// Инициализация DOM элементов
function cacheDomElements() {
    const ids = ['booksGrid', 'loadingIndicator', 'errorMessage', 'readerWindow', 'overlay',
                 'readerTitle', 'readerContent', 'currentPage', 'totalPages', 'currentYear',
                 'themeToggle', 'closeReader', 'prevPage', 'nextPage',
                 'fontPlus', 'fontMinus', 'fullscreenBtn', 'exitFullscreenBtn',
                 'fullscreenPrevBtn', 'fullscreenNextBtn', 'mainPage', 'genresPage', 'authorsPage',
                 'genresList', 'authorsList'];

    ids.forEach(id => {
        DOM[id] = document.getElementById(id);
    });
}

// Определение устройства
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

const DEVICE_CONFIG = {
    mobile: { lineHeight: 1.5, padding: 15 },
    tablet: { lineHeight: 1.6, padding: 25 },
    desktop: { lineHeight: 1.8, padding: 40 }
};

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

function applyDeviceLayout() {
    if (!DOM.readerContent) return;
    const config = DEVICE_CONFIG[getDeviceType()];
    DOM.readerContent.style.lineHeight = config.lineHeight;
    DOM.readerContent.style.padding = config.padding + 'px';
}

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

let allBooks = [];
let currentBook = null;
let currentPage = 1;
let fontSize = 18;
let isFullscreen = false;
let isLoading = false;
let menuActive = false;
let currentView = 'main';

const DEFAULT_BOOK_FILES = [
    'book8.json', 'book7.json', 'book6.json', 'book5.json',
    'book4.json', 'book3.json', 'book2.json', 'book1.json'
];

// === ПОИСК КНИГ ===
function addSearchBar() {
    const introSection = document.querySelector('#mainPage .intro');
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

// Переключение страниц - теперь скрывает/показывает
function showPage(page) {
    if (DOM.mainPage) DOM.mainPage.style.display = 'none';
    if (DOM.genresPage) DOM.genresPage.style.display = 'none';
    if (DOM.authorsPage) DOM.authorsPage.style.display = 'none';

    switch(page) {
        case 'main':
            if (DOM.mainPage) DOM.mainPage.style.display = 'block';
            break;
        case 'genres':
            if (DOM.genresPage) DOM.genresPage.style.display = 'block';
            break;
        case 'authors':
            if (DOM.authorsPage) DOM.authorsPage.style.display = 'block';
            break;
    }

    currentView = page;
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    cacheDomElements();
    if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();
    showPage('main');
    setupTheme();
    setupReader();
    setupSideMenu();
    setupCategoryPages();
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

// ========== НАСТРОЙКА СТРАНИЦ ЖАНРОВ/АВТОРОВ ==========
function setupCategoryPages() {
    document.getElementById('backFromGenres')?.addEventListener('click', () => showPage('main'));
    document.getElementById('backFromAuthors')?.addEventListener('click', () => showPage('main'));
}

function showGenresPage() {
    if (!allBooks || allBooks.length === 0) return;
    
    const genresMap = new Map();
    allBooks.forEach(book => {
        const genre = book.genre || 'Без жанра';
        if (!genresMap.has(genre)) {
            genresMap.set(genre, []);
        }
        genresMap.get(genre).push(book);
    });

    const fragment = document.createDocumentFragment();
    Array.from(genresMap.entries()).forEach(([genre, books]) => {
        const item = document.createElement('button');
        item.className = 'category-item';
        item.innerHTML = `
            <span>${escapeHtml(genre)}</span>
            <span class="count">${books.length} кн.</span>
        `;
        item.addEventListener('click', () => {
            const filtered = allBooks.filter(book => (book.genre || 'Без жанра') === genre);
            renderBooks(filtered);
            showPage('main');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        fragment.appendChild(item);
    });

    DOM.genresList.innerHTML = '';
    DOM.genresList.appendChild(fragment);
    showPage('genres');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAuthorsPage() {
    if (!allBooks || allBooks.length === 0) return;
    
    const authorsMap = new Map();
    allBooks.forEach(book => {
        const author = book.author || 'Неизвестный автор';
        if (!authorsMap.has(author)) {
            authorsMap.set(author, []);
        }
        authorsMap.get(author).push(book);
    });

    const fragment = document.createDocumentFragment();
    Array.from(authorsMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([author, books]) => {
            const item = document.createElement('button');
            item.className = 'category-item';
            item.innerHTML = `
                <span>${escapeHtml(author)}</span>
                <span class="count">${books.length} кн.</span>
            `;
            item.addEventListener('click', () => {
                const filtered = allBooks.filter(book => (book.author || 'Неизвестный автор') === author);
                renderBooks(filtered);
                showPage('main');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            fragment.appendChild(item);
        });

    DOM.authorsList.innerHTML = '';
    DOM.authorsList.appendChild(fragment);
    showPage('authors');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== БОКОВОЕ МЕНЮ (ОДИН СВАЙП) ==========
function setupSideMenu() {
    const burgerBtn = document.getElementById('burgerBtn');
    const sideMenu = document.getElementById('sideMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const sideMenuClose = document.getElementById('sideMenuClose');
    const menuGenres = document.getElementById('menuGenres');
    const menuAuthors = document.getElementById('menuAuthors');
    const menuAll = document.getElementById('menuAll');

    if (!burgerBtn || !sideMenu) return;

    function openMenu() {
        sideMenu.classList.add('active');
        sideMenu.style.right = '0px';
        menuOverlay.classList.add('active');
        menuOverlay.style.display = 'block';
        menuOverlay.style.opacity = '1';
        menuActive = true;
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        sideMenu.classList.remove('active');
        sideMenu.style.right = '-320px';
        menuOverlay.classList.remove('active');
        menuOverlay.style.opacity = '0';
        menuActive = false;
        document.body.style.overflow = '';
        setTimeout(() => {
            if (!menuActive) menuOverlay.style.display = 'none';
        }, 300);
    }

    burgerBtn.addEventListener('click', openMenu);
    sideMenuClose.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuActive) closeMenu();
    });

    // ===== ОТКРЫТИЕ СВАЙПОМ (один свайп) =====
    let startX = 0;

    document.addEventListener('touchstart', (e) => {
        if (menuActive) return;
        startX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (menuActive) return;
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        
        // Свайп справа налево больше 50px
        if (startX > window.innerWidth - 40 && diff > 50) {
            openMenu();
        }
        
        startX = 0;
    });

    // ===== ЗАКРЫТИЕ СВАЙПОМ =====
    let menuStartX = 0;
    let menuCurrentX = 0;
    let menuSwiping = false;

    sideMenu.addEventListener('touchstart', (e) => {
        if (!menuActive) return;
        menuStartX = e.touches[0].clientX;
        menuCurrentX = menuStartX;
        menuSwiping = true;
    }, { passive: true });

    sideMenu.addEventListener('touchmove', (e) => {
        if (!menuSwiping || !menuActive) return;
        menuCurrentX = e.touches[0].clientX;
        const diff = menuCurrentX - menuStartX;
        if (diff > 0) {
            sideMenu.style.right = '-' + Math.min(diff, 300) + 'px';
            menuOverlay.style.opacity = 1 - Math.min(diff / 300, 1);
        }
    }, { passive: true });

    sideMenu.addEventListener('touchend', () => {
        if (!menuSwiping || !menuActive) {
            menuSwiping = false;
            return;
        }
        menuSwiping = false;
        
        const diff = menuCurrentX - menuStartX;
        if (diff > 80) {
            closeMenu();
        } else {
            sideMenu.style.right = '0px';
            menuOverlay.style.opacity = '1';
        }
    });

    menuGenres.addEventListener('click', () => {
        closeMenu();
        setTimeout(() => showGenresPage(), 300);
    });

    menuAuthors.addEventListener('click', () => {
        closeMenu();
        setTimeout(() => showAuthorsPage(), 300);
    });

    menuAll.addEventListener('click', () => {
        closeMenu();
        setTimeout(() => {
            renderBooks(allBooks);
            showPage('main');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    });
}

    // Кнопки
    burgerBtn.addEventListener('click', openMenu);
    sideMenuClose.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuActive) closeMenu();
    });

    // Свайп для открытия — только touchstart и touchend, без move
    document.addEventListener('touchstart', (e) => {
        if (menuActive) return;
        const x = e.touches[0].clientX;
        if (x > window.innerWidth - 25) {
            touchStart = x;
            isDragging = true;
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isDragging || menuActive) {
            isDragging = false;
            return;
        }
        isDragging = false;
        
        // Проверяем, был ли это свайп влево
        if (touchEnd > 0 && touchStart - touchEnd > 50) {
            openMenu();
        }
        
        touchStart = 0;
        touchEnd = 0;
    });

    // Отслеживаем только последнюю позицию
    document.addEventListener('touchmove', (e) => {
        if (isDragging && !menuActive) {
            touchEnd = e.touches[0].clientX;
        }
    }, { passive: true });

    // Свайп для закрытия — на самом меню
    sideMenu.addEventListener('touchstart', (e) => {
        if (!menuActive) return;
        touchStart = e.touches[0].clientX;
        isDragging = true;
    }, { passive: true });

    sideMenu.addEventListener('touchmove', (e) => {
        if (!isDragging || !menuActive) return;
        touchEnd = e.touches[0].clientX;
        const diff = touchEnd - touchStart;
        if (diff > 0) {
            const move = Math.min(diff, 300);
            sideMenu.style.right = '-' + move + 'px';
            menuOverlay.style.opacity = 1 - (move / 300);
        }
    }, { passive: true });

    sideMenu.addEventListener('touchend', () => {
        if (!isDragging || !menuActive) {
            isDragging = false;
            return;
        }
        isDragging = false;
        
        const diff = touchEnd - touchStart;
        if (diff > 80) {
            closeMenu();
        } else {
            sideMenu.style.right = '0px';
            menuOverlay.style.opacity = '1';
        }
        
        touchStart = 0;
        touchEnd = 0;
    });

    // Кнопки меню
    menuGenres.addEventListener('click', () => {
        closeMenu();
        setTimeout(() => showGenresPage(), 300);
    });

    menuAuthors.addEventListener('click', () => {
        closeMenu();
        setTimeout(() => showAuthorsPage(), 300);
    });

    menuAll.addEventListener('click', () => {
        closeMenu();
        setTimeout(() => {
            renderBooks(allBooks);
            showPage('main');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    });
}
// ========== ТЕМА ==========
function setupTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    document.body.classList.add(savedTheme + '-theme');
    
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
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

// ========== ЧИТАЛКА ==========
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
        DOM.fontPlus.addEventListener('click', () => {
            fontSize = Math.min(fontSize + 2, 30);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        });
    }
    if (DOM.fontMinus) {
        DOM.fontMinus.addEventListener('click', () => {
            fontSize = Math.max(fontSize - 2, 14);
            if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
        });
    }

    document.addEventListener('keydown', (e) => {
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
        statusDiv.style.cssText = 'position:fixed;bottom:10px;right:16px;padding:6px 12px;border-radius:20px;font-size:12px;z-index:999;background:rgba(0,0,0,0.7);color:white;pointer-events:none;';
        document.body.appendChild(statusDiv);
    }
    statusDiv.textContent = navigator.onLine ? '● Онлайн' : '○ Офлайн';
    statusDiv.style.background = navigator.onLine ? 'rgba(46,125,50,0.9)' : 'rgba(128,128,128,0.9)';
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
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