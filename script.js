// Кэш для DOM элементов
const DOM = {};

// История навигации для кнопки "назад"
let navigationHistory = [];

// Инициализация DOM элементов
function cacheDomElements() {
    const ids = ['booksGrid', 'loadingIndicator', 'errorMessage', 'readerWindow', 'overlay',
                 'readerTitle', 'readerContent', 'currentPage', 'totalPages', 'currentYear',
                 'themeToggle', 'closeReader', 'prevPage', 'nextPage',
                 'fontPlus', 'fontMinus', 'fullscreenBtn', 'exitFullscreenBtn',
                 'fullscreenPrevBtn', 'fullscreenNextBtn', 'mainPage', 'genresPage', 'authorsPage',
                 'favoritesPage', 'favoritesBooksGrid',
                 'genresList', 'authorsList', 'menuFavorites', 'menuFeedback',
                 'backFromFavorites'];

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

// === КОММЕНТАРИИ (Google Sheets) ===
const COMMENTS_API_URL = 'https://script.google.com/macros/s/AKfycbxk-JzUsqjqTFKjgXdKM5Fxr7JCdoyfQhJyhHIP83WNsxkpFDB4RSgiIWiC0EFxYmpQ/exec';

async function getComments(bookId) {
    try {
        const res = await fetch(`${COMMENTS_API_URL}?bookId=${bookId}&t=${Date.now()}`);
        const text = await res.text();
        return JSON.parse(text);
    } catch(e) { return []; }
}

async function saveComment(bookId, name, text) {
    try {
        const params = new URLSearchParams({
            mode: 'add',
            bookId: String(bookId),
            name: name,
            text: text
        });
        const res = await fetch(`${COMMENTS_API_URL}?${params.toString()}`);
        return res.ok;
    } catch(e) { return false; }
}

async function addComment(bookId) {
    const nameInput = document.getElementById('commentName');
    const textInput = document.getElementById('commentText');
    const submitBtn = document.querySelector('#commentForm .btn-submit');
    
    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    if (!name || !text) return;
    
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳';
    
    const saved = await saveComment(bookId, name, text);
    
    if (saved) {
        nameInput.value = '';
        textInput.value = '';
        await loadComments(bookId);
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = '📨 Отправить';
}

async function loadComments(bookId) {
    const list = document.getElementById('commentsList');
    if (!list) return;
    
    list.innerHTML = '<div class="comment-empty">Загрузка...</div>';
    
    const comments = await getComments(bookId);
    
    if (!comments || comments.length === 0) {
        list.innerHTML = '<div class="comment-empty">💬 Пока нет комментариев</div>';
        return;
    }
    
    list.innerHTML = comments.map(c => `
        <div class="comment-item">
            <div class="comment-author">${escapeHtml(c.name)}<span class="comment-date">${formatDate(c.date)}</span></div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
    `).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString('ru-RU');
}

// === ПОИСК КНИГ ===
function addSearchBar() {
    const titleElement = document.querySelector('#mainPage h2');
    if (!titleElement) return;
    if (document.getElementById('globalSearchInput')) return;

    const searchHTML = `
        <div class="search-container">
            <input type="text" id="globalSearchInput" class="search-input"
                   placeholder="Поиск по названию, автору или жанру..."
                   autocomplete="off">
            <div id="globalSearchResults" class="search-results-dropdown" style="display: none;"></div>
        </div>
    `;

    titleElement.insertAdjacentHTML('afterend', searchHTML);

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
            const genreMatch = book.genre?.toLowerCase().includes(lowerQuery);
            
            if (titleMatch || authorMatch || genreMatch) {
                let matchType = '';
                if (titleMatch) matchType = '📖 в названии';
                else if (authorMatch) matchType = '✍️ у автора';
                else if (genreMatch) matchType = '📂 в жанре';
                
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

function showPage(page, addToHistory = true) {
    if (addToHistory && currentView !== page) {
        navigationHistory.push(currentView);
        if (navigationHistory.length > 10) navigationHistory.shift();
        const url = page === 'main' ? '/' : '/' + page;
        history.pushState({ page, navHistory: [...navigationHistory], menuOpen: false, feedbackOpen: false }, '', url);
    }

    if (DOM.mainPage) DOM.mainPage.style.display = 'none';
    if (DOM.genresPage) DOM.genresPage.style.display = 'none';
    if (DOM.authorsPage) DOM.authorsPage.style.display = 'none';
    if (DOM.favoritesPage) DOM.favoritesPage.style.display = 'none';

    switch(page) {
        case 'main': if (DOM.mainPage) DOM.mainPage.style.display = 'block'; break;
        case 'genres': if (DOM.genresPage) DOM.genresPage.style.display = 'block'; break;
        case 'authors': if (DOM.authorsPage) DOM.authorsPage.style.display = 'block'; break;
        case 'favorites': if (DOM.favoritesPage) DOM.favoritesPage.style.display = 'block'; break;
    }
    currentView = page;
}

function goBack() {
    if (navigationHistory.length > 0) {
        const previousPage = navigationHistory.pop();
        showPage(previousPage, false);
        if (previousPage === 'main') {
            history.replaceState({ page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false }, '', '/');
        }
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    cacheDomElements();
    if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();
    showPage('main', false);
    setupTheme();
    setupReader();
    setupSideMenu();
    setupCategoryPages();
    updateConnectionStatus();

    const style = document.createElement('style');
    style.textContent = `.reader-content { transition: padding 0.2s ease, line-height 0.2s ease; }`;
    document.head.appendChild(style);

    await loadAllBooks();
    addSearchBar();
    registerServiceWorker();

    window.addEventListener('popstate', (e) => {
        const feedbackModal = document.getElementById('feedbackModal');
        if (feedbackModal && feedbackModal.classList.contains('active')) {
            closeFeedback(false);
            return;
        }

        if (menuActive) {
            const sideMenu = document.getElementById('sideMenu');
            const menuOverlay = document.getElementById('menuOverlay');
            sideMenu.classList.remove('active');
            sideMenu.style.right = '-320px';
            menuOverlay.classList.remove('active');
            menuOverlay.style.opacity = '0';
            menuActive = false;
            document.body.style.overflow = '';
            setTimeout(() => { if (!menuActive) menuOverlay.style.display = 'none'; }, 300);
            if (currentView === 'main') {
                history.replaceState({ page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false }, '', '/');
            }
            return;
        }

        if (DOM.readerWindow && DOM.readerWindow.style.display === 'flex') {
            closeReader(false);
            return;
        }

        if (e.state && e.state.page) {
            showPage(e.state.page, false);
            if (e.state.navHistory) navigationHistory = e.state.navHistory;
            if (e.state.page === 'main') {
                history.replaceState({ page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false }, '', '/');
            }
            return;
        }

        showPage('main', false);
        history.replaceState({ page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false }, '', '/');
    });

    history.replaceState({ page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false }, '', '/');
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            setInterval(() => reg.update(), 60 * 60 * 1000);
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        localStorage.removeItem('cachedBooks');
                        localStorage.removeItem('cacheTimestamp');
                        window.location.reload();
                    }
                });
            });
        }).catch(() => {});
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
            return;
        }

        let bookFiles = [];
        try {
            const response = await fetch('books-list.json?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) bookFiles = data;
            }
        } catch(e) {}

        if (bookFiles.length === 0) bookFiles = DEFAULT_BOOK_FILES;

        allBooks = [];
        for (let i = 0; i < bookFiles.length; i++) {
            try {
                const res = await fetch(bookFiles[i] + '?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.title && data.pages) {
                        data.id = i + 1;
                        allBooks.push(data);
                    }
                }
            } catch(e) {}
        }

        if (allBooks.length > 0) {
            renderBooks(allBooks);
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
            } catch(e) {}
        }
    } catch(error) {
        const cacheLoaded = await loadFromCache();
        if (!cacheLoaded && DOM.errorMessage) {
            DOM.errorMessage.style.display = 'block';
            DOM.errorMessage.innerHTML = '<h3>Ошибка загрузки</h3><button id="retryButton" class="btn btn-read">Повторить</button>';
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
            if (allBooks && allBooks.length > 0) { renderBooks(allBooks); return true; }
        }
    } catch(e) {}
    return false;
}

function renderBooks(books, targetGrid) {
    const grid = targetGrid || DOM.booksGrid;
    if (!grid) return;
    if (!books || books.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;">Книги не найдены</div>';
        return;
    }
    const fragment = document.createDocumentFragment();
    for (const book of books) {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div class="book-cover">${escapeHtml(book.cover || book.title)}</div>
            <div class="book-title">${escapeHtml(book.title)}</div>
            <div class="book-meta">
                <p><strong>Автор:</strong> ${escapeHtml(book.author || 'Неизвестен')}</p>
                <p><strong>Жанр:</strong> ${escapeHtml(book.genre || 'Без жанра')}</p>
                <p><strong>Год:</strong> ${escapeHtml(book.year || '-')}</p>
                <p><strong>Страниц:</strong> ${book.pages?.length || 0}</p>
            </div>
            <div class="book-buttons">
                <button class="btn btn-read">📖 Читать</button>
                <button class="btn btn-favorite">⭐</button>
            </div>
            <button class="btn btn-comments-card">💬 Комментарии</button>
        `;
        card.querySelector('.btn-read').addEventListener('click', () => openBook(book.id));
        card.querySelector('.btn-favorite').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(book.id, card.querySelector('.btn-favorite'));
        });
        card.querySelector('.btn-comments-card').addEventListener('click', (e) => {
            e.stopPropagation();
            openBook(book.id);
            setTimeout(() => {
                document.getElementById('commentsBody')?.classList.add('open');
                document.getElementById('commentsToggle')?.classList.add('open');
            }, 500);
        });
        if (isFavorite(book.id)) {
            card.querySelector('.btn-favorite').classList.add('active');
            card.querySelector('.btn-favorite').textContent = '★';
        }
        fragment.appendChild(card);
    }
    grid.innerHTML = '';
    grid.appendChild(fragment);
}

window.openBook = function(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book?.pages?.length) return;

    history.pushState({ page: 'reader', bookId, navHistory: [...navigationHistory] }, '', '/book/' + bookId);

    currentBook = JSON.parse(JSON.stringify(book));
    currentPage = getReadingProgress(bookId);
    if (currentPage > currentBook.pages.length) currentPage = 1;

    fontSize = getDeviceType() === 'mobile' ? 14 : getDeviceType() === 'tablet' ? 16 : 18;

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
    loadComments(bookId);
    document.getElementById('commentsBody')?.classList.remove('open');
    document.getElementById('commentsToggle')?.classList.remove('open');
};

function setupCategoryPages() {
    document.getElementById('backFromGenres')?.addEventListener('click', goBack);
    document.getElementById('backFromAuthors')?.addEventListener('click', goBack);
    document.getElementById('backFromFavorites')?.addEventListener('click', goBack);
}

function showGenresPage() {
    if (!allBooks.length) return;
    const map = new Map();
    allBooks.forEach(b => { const g = b.genre || 'Без жанра'; if (!map.has(g)) map.set(g, []); map.get(g).push(b); });
    const f = document.createDocumentFragment();
    map.forEach((books, genre) => {
        const btn = document.createElement('button');
        btn.className = 'category-item';
        btn.innerHTML = `<span>${escapeHtml(genre)}</span><span class="count">${books.length} кн.</span>`;
        btn.addEventListener('click', () => { renderBooks(allBooks.filter(b => (b.genre||'Без жанра')===genre)); showPage('main'); scrollTo(0,0); });
        f.appendChild(btn);
    });
    DOM.genresList.innerHTML = '';
    DOM.genresList.appendChild(f);
    showPage('genres');
}

function showAuthorsPage() {
    if (!allBooks.length) return;
    const map = new Map();
    allBooks.forEach(b => { const a = b.author || 'Неизвестен'; if (!map.has(a)) map.set(a, []); map.get(a).push(b); });
    const f = document.createDocumentFragment();
    [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([author, books]) => {
        const btn = document.createElement('button');
        btn.className = 'category-item';
        btn.innerHTML = `<span>${escapeHtml(author)}</span><span class="count">${books.length} кн.</span>`;
        btn.addEventListener('click', () => { renderBooks(allBooks.filter(b=>(b.author||'Неизвестен')===author)); showPage('main'); scrollTo(0,0); });
        f.appendChild(btn);
    });
    DOM.authorsList.innerHTML = '';
    DOM.authorsList.appendChild(f);
    showPage('authors');
}

// Избранное
function getFavorites() { try { return JSON.parse(localStorage.getItem('favorites')||'[]'); } catch(e) { return []; } }
function saveFavorites(f) { localStorage.setItem('favorites', JSON.stringify(f)); }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id, btn) {
    const f = getFavorites();
    const i = f.indexOf(id);
    if (i > -1) { f.splice(i,1); if(btn){btn.classList.remove('active');btn.textContent='⭐';} }
    else { f.push(id); if(btn){btn.classList.add('active');btn.textContent='★';} }
    saveFavorites(f);
}
function showFavorites() {
    const fav = getFavorites();
    const grid = document.getElementById('favoritesBooksGrid');
    if (!grid) return;
    if (!fav.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;">⭐ Пока нет избранных книг</div>'; }
    else renderBooks(allBooks.filter(b => fav.includes(b.id)), grid);
    showPage('favorites');
}

// Боковое меню
function setupSideMenu() {
    const burger = document.getElementById('burgerBtn');
    const menu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    if (!burger || !menu) return;

    function open() {
        menu.classList.add('active'); menu.style.right='0'; overlay.classList.add('active');
        overlay.style.display='block'; overlay.style.opacity='1'; menuActive=true;
        document.body.style.overflow='hidden';
        history.pushState({ page: currentView, menuOpen: true }, '', '/menu');
    }
    function close(h) {
        menu.classList.remove('active'); menu.style.right='-320px'; overlay.classList.remove('active');
        overlay.style.opacity='0'; menuActive=false; document.body.style.overflow='';
        setTimeout(()=>{ if(!menuActive) overlay.style.display='none'; },300);
        if(h && history.state?.menuOpen) history.back();
    }

    burger.addEventListener('click', open);
    document.getElementById('sideMenuClose').addEventListener('click', ()=>close(true));
    overlay.addEventListener('click', ()=>close(true));
    document.addEventListener('keydown', e => { if(e.key==='Escape'&&menuActive) close(true); });

    let sx=0;
    document.addEventListener('touchstart', e => { if(!menuActive) sx=e.touches[0].clientX; }, {passive:true});
    document.addEventListener('touchend', e => {
        if(menuActive) return;
        const ex = e.changedTouches[0].clientX;
        if(sx > innerWidth-40 && sx-ex > 50) open();
    });

    let msx=0, mcx=0, sw=false;
    menu.addEventListener('touchstart', e => { if(!menuActive) return; msx=e.touches[0].clientX; mcx=msx; sw=true; }, {passive:true});
    menu.addEventListener('touchmove', e => {
        if(!sw||!menuActive) return;
        mcx=e.touches[0].clientX;
        const d=mcx-msx;
        if(d>0){ menu.style.right='-'+Math.min(d,300)+'px'; overlay.style.opacity=1-Math.min(d/300,1); }
    }, {passive:true});
    menu.addEventListener('touchend', () => {
        if(!sw||!menuActive){sw=false;return;}
        sw=false;
        if(mcx-msx>80) close(true);
        else { menu.style.right='0'; overlay.style.opacity='1'; }
    });

    document.getElementById('menuGenres').addEventListener('click', ()=>{close(false);setTimeout(showGenresPage,300);});
    document.getElementById('menuAuthors').addEventListener('click', ()=>{close(false);setTimeout(showAuthorsPage,300);});
    document.getElementById('menuFavorites').addEventListener('click', ()=>{close(false);setTimeout(showFavorites,300);});
    document.getElementById('menuFeedback').addEventListener('click', ()=>{close(false);setTimeout(openFeedback,300);});
    document.getElementById('menuAll').addEventListener('click', ()=>{close(false);setTimeout(()=>{renderBooks(allBooks);showPage('main');scrollTo(0,0);},300);});
}

// Обратная связь
function openFeedback() {
    const m = document.getElementById('feedbackModal');
    if(!m) return;
    history.pushState({ page: currentView, feedbackOpen: true }, '', '/feedback');
    document.getElementById('feedbackForm').innerHTML = `
        <div class="feedback-field"><label>Имя</label><input id="feedbackName" placeholder="Необязательно"></div>
        <div class="feedback-field"><label>Тема</label><select id="feedbackTopic"><option value="bug">🐛 Ошибка</option><option value="feature">💡 Предложение</option><option value="other">💬 Другое</option></select></div>
        <div class="feedback-field"><label>Сообщение</label><textarea id="feedbackMessage" rows="5" required></textarea></div>
        <button type="submit" class="btn-submit">📨 Отправить</button>
    `;
    m.classList.add('active'); document.body.style.overflow='hidden';
    document.getElementById('feedbackClose').onclick = ()=>closeFeedback(true);
    document.getElementById('feedbackOverlay').onclick = ()=>closeFeedback(true);
    document.getElementById('feedbackForm').onsubmit = submitFeedback;
}
function closeFeedback(h) {
    const m = document.getElementById('feedbackModal');
    if(!m) return;
    m.classList.remove('active'); document.body.style.overflow='';
    if(h && history.state?.feedbackOpen) history.back();
}
function submitFeedback(e) {
    e.preventDefault();
    const name = document.getElementById('feedbackName').value || 'Аноним';
    const topic = document.getElementById('feedbackTopic').value;
    const msg = document.getElementById('feedbackMessage').value;
    const subj = `[Библиотека] ${({bug:'Ошибка',feature:'Предложение',other:'Другое'})[topic]} от ${name}`;
    const body = `Имя: ${name}\nТема: ${({bug:'Ошибка',feature:'Предложение',other:'Другое'})[topic]}\n\n${msg}`;
    document.getElementById('feedbackForm').innerHTML = `<div class="feedback-success"><div class="success-icon">✅</div><h3>Спасибо!</h3><p>Сообщение отправлено.</p><button class="btn-submit" onclick="closeFeedback(true)" style="margin-top:15px">Закрыть</button></div>`;
    const mob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if(mob) location.href = `mailto:cheburekus2012@gmail.com?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    else open(`https://mail.google.com/mail/?view=cm&fs=1&to=cheburekus2012@gmail.com&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`, '_blank');
}

// Тема
function setupTheme() {
    const t = localStorage.getItem('selectedTheme')||'light';
    document.body.classList.add(t+'-theme');
    updateThemeIcon(t);
    document.getElementById('themeToggle').addEventListener('click', () => {
        if(document.body.classList.contains('light-theme')) {
            document.body.classList.replace('light-theme','dark-theme');
            localStorage.setItem('selectedTheme','dark');
            updateThemeIcon('dark');
        } else {
            document.body.classList.replace('dark-theme','light-theme');
            localStorage.setItem('selectedTheme','light');
            updateThemeIcon('light');
        }
    });
}
function updateThemeIcon(t) {
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    btn.querySelector('.theme-icon-light').style.display = t==='dark'?'none':'inline';
    btn.querySelector('.theme-icon-dark').style.display = t==='dark'?'inline':'none';
}

// Читалка
function setupReader() {
    const prev = () => { if(currentBook&&currentPage>1){currentPage--;updateReaderContent();saveReadingProgress(currentBook.id,currentPage);} };
    const next = () => { if(currentBook&&currentPage<currentBook.pages.length){currentPage++;updateReaderContent();saveReadingProgress(currentBook.id,currentPage);} };

    DOM.prevPage?.addEventListener('click', prev);
    DOM.nextPage?.addEventListener('click', next);
    DOM.fullscreenPrevBtn?.addEventListener('click', prev);
    DOM.fullscreenNextBtn?.addEventListener('click', next);
    DOM.closeReader?.addEventListener('click', ()=>closeReader(true));
    DOM.overlay?.addEventListener('click', ()=>closeReader(true));
    DOM.exitFullscreenBtn?.addEventListener('click', toggleFullscreen);
    DOM.fullscreenBtn?.addEventListener('click', toggleFullscreen);
    DOM.fontPlus?.addEventListener('click', ()=>{fontSize=Math.min(fontSize+2,30);if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px';});
    DOM.fontMinus?.addEventListener('click', ()=>{fontSize=Math.max(fontSize-2,14);if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px';});

    document.getElementById('commentsHeader')?.addEventListener('click', () => {
        document.getElementById('commentsBody').classList.toggle('open');
        document.getElementById('commentsToggle').classList.toggle('open');
    });
    document.getElementById('commentForm')?.addEventListener('submit', e => { e.preventDefault(); addComment(currentBook.id); });

    document.addEventListener('keydown', e => {
        if(!DOM.readerWindow||DOM.readerWindow.style.display!=='flex') return;
        if(e.key==='Escape'){ if(isFullscreen)toggleFullscreen(); else closeReader(true); }
        else if(e.key==='ArrowLeft'||e.key==='PageUp'){ e.preventDefault(); prev(); }
        else if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); next(); }
        else if(e.key==='f'||e.key==='F'){ e.preventDefault(); toggleFullscreen(); }
        else if(e.key==='+'||e.key==='='){ e.preventDefault(); fontSize=Math.min(fontSize+2,30); if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px'; }
        else if(e.key==='-'||e.key==='_'){ e.preventDefault(); fontSize=Math.max(fontSize-2,14); if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px'; }
    });
}

function updateReaderContent() {
    if(!currentBook||!DOM.readerContent) return;
    DOM.readerContent.innerHTML = currentBook.pages[currentPage-1];
    DOM.readerContent.style.fontSize = fontSize+'px';
    DOM.readerContent.scrollTop = 0;
    if(DOM.currentPage) DOM.currentPage.textContent = currentPage;
}

window.toggleFullscreen = function() {
    if(!DOM.readerWindow) return;
    if(!isFullscreen){ DOM.readerWindow.classList.add('fullscreen'); if(DOM.overlay)DOM.overlay.style.display='none'; isFullscreen=true; }
    else { DOM.readerWindow.classList.remove('fullscreen'); if(DOM.overlay)DOM.overlay.style.display='block'; isFullscreen=false; applyDeviceLayout(); }
};

window.closeReader = function(h=true) {
    if(currentBook?.id) saveReadingProgress(currentBook.id, currentPage);
    if(isFullscreen) toggleFullscreen();
    if(DOM.readerWindow) DOM.readerWindow.style.display='none';
    if(DOM.overlay) DOM.overlay.style.display='none';
    if(h) history.back();
};

window.retryLoading = function() {
    if(DOM.errorMessage) DOM.errorMessage.style.display='none';
    localStorage.removeItem('cachedBooks');
    localStorage.removeItem('cacheTimestamp');
    allBooks = [];
    loadAllBooks();
};

function updateConnectionStatus() {
    let d = document.getElementById('connection-status');
    if(!d) {
        d = document.createElement('div');
        d.id = 'connection-status';
        d.style.cssText = 'position:fixed;bottom:10px;right:16px;padding:6px 12px;border-radius:20px;font-size:12px;z-index:999;background:rgba(0,0,0,0.7);color:white;pointer-events:none;';
        document.body.appendChild(d);
    }
    d.textContent = navigator.onLine ? '● Онлайн' : '○ Офлайн';
    d.style.background = navigator.onLine ? 'rgba(46,125,50,0.9)' : 'rgba(128,128,128,0.9)';
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        cachedDeviceType = null;
        if(currentBook && DOM.readerWindow?.style.display==='flex') {
            applyDeviceLayout();
            if(currentPage > currentBook.pages.length) { currentPage = currentBook.pages.length; updateReaderContent(); saveReadingProgress(currentBook.id, currentPage); }
        }
    }, 150);
});

window.loadAllBooks = loadAllBooks;
