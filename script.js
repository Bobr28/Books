// Кэш для DOM элементов
const DOM = {};

// История навигации для кнопки "назад"
let navigationHistory = [];

function cacheDomElements() {
    const ids = ['booksGrid', 'loadingIndicator', 'errorMessage', 'readerWindow', 'overlay',
                 'readerTitle', 'readerContent', 'currentPage', 'totalPages', 'currentYear',
                 'themeToggle', 'closeReader', 'prevPage', 'nextPage',
                 'fontPlus', 'fontMinus', 'fullscreenBtn', 'exitFullscreenBtn',
                 'fullscreenPrevBtn', 'fullscreenNextBtn', 'mainPage', 'genresPage', 'authorsPage',
                 'favoritesPage', 'favoritesBooksGrid',
                 'genresList', 'authorsList', 'menuFavorites', 'menuFeedback', 'backFromFavorites'];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
}

let cachedDeviceType = null, cachedWidth = 0;
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
const DEVICE_CONFIG = { mobile: { lineHeight: 1.5, padding: 15 }, tablet: { lineHeight: 1.6, padding: 25 }, desktop: { lineHeight: 1.8, padding: 40 } };

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function applyDeviceLayout() { if (!DOM.readerContent) return; const c = DEVICE_CONFIG[getDeviceType()]; DOM.readerContent.style.lineHeight = c.lineHeight; DOM.readerContent.style.padding = c.padding + 'px'; }
function saveReadingProgress(bookId, page) { if (!bookId) return; try { const p = JSON.parse(localStorage.getItem('readingProgress') || '{}'); if (p[bookId] !== page) { p[bookId] = page; localStorage.setItem('readingProgress', JSON.stringify(p)); } } catch(e) {} }
function getReadingProgress(bookId) { if (!bookId) return 1; try { return JSON.parse(localStorage.getItem('readingProgress') || '{}')[bookId] || 1; } catch(e) { return 1; } }

let allBooks = [], currentBook = null, currentPage = 1, fontSize = 18, isFullscreen = false, isLoading = false, menuActive = false, currentView = 'main';
const DEFAULT_BOOK_FILES = ['book8.json', 'book7.json', 'book6.json', 'book5.json', 'book4.json', 'book3.json', 'book2.json', 'book1.json'];

// === КОММЕНТАРИИ ===
const COMMENTS_API_URL = 'https://script.google.com/macros/s/AKfycbxk-JzUsqjqTFKjgXdKM5Fxr7JCdoyfQhJyhHIP83WNsxkpFDB4RSgiIWiC0EFxYmpQ/exec';

async function getComments(bookId) { try { const r = await fetch(`${COMMENTS_API_URL}?bookId=${bookId}&t=${Date.now()}`); return JSON.parse(await r.text()); } catch(e) { return []; } }
async function saveComment(bookId, name, text) { try { const p = new URLSearchParams({ mode: 'add', bookId: String(bookId), name, text }); const r = await fetch(`${COMMENTS_API_URL}?${p.toString()}`); return r.ok; } catch(e) { return false; } }

function openComments(bookId) {
    const modal = document.getElementById('commentsModal');
    if (!modal) return;
    modal.classList.add('active'); document.body.style.overflow = 'hidden';
    loadComments(bookId);
    document.getElementById('commentsClose').onclick = closeComments;
    document.getElementById('commentsOverlay').onclick = closeComments;
    document.getElementById('commentForm').onsubmit = (e) => { e.preventDefault(); addComment(bookId); };
}
function closeComments() { const m = document.getElementById('commentsModal'); if(m) { m.classList.remove('active'); document.body.style.overflow = ''; } }

async function addComment(bookId) {
    const ni = document.getElementById('commentName'), ti = document.getElementById('commentText');
    const btn = document.querySelector('#commentForm .btn-submit');
    const name = ni.value.trim(), text = ti.value.trim();
    if (!name || !text) return;
    btn.disabled = true; btn.textContent = '⏳';
    if (await saveComment(bookId, name, text)) { ni.value = ''; ti.value = ''; await loadComments(bookId); }
    btn.disabled = false; btn.textContent = '📨 Отправить';
}
async function loadComments(bookId) {
    const list = document.getElementById('commentsList'); if (!list) return;
    list.innerHTML = '<div class="comment-empty">Загрузка...</div>';
    const comments = await getComments(bookId);
    if (!comments || comments.length === 0) { list.innerHTML = '<div class="comment-empty">💬 Пока нет комментариев</div>'; return; }
    list.innerHTML = comments.map(c => `<div class="comment-item"><div class="comment-author">${escapeHtml(c.name)}<span class="comment-date">${formatDate(c.date)}</span></div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join('');
}
function formatDate(dateString) {
    const d = new Date(dateString), n = new Date(), diff = n - d;
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
    if (m < 1) return 'Только что'; if (m < 60) return `${m} мин. назад`;
    if (h < 24) return `${h} ч. назад`; if (days < 7) return `${days} дн. назад`;
    return d.toLocaleDateString('ru-RU');
}

// === ПОИСК ===
function addSearchBar() {
    const te = document.querySelector('#mainPage h2'); if (!te || document.getElementById('globalSearchInput')) return;
    te.insertAdjacentHTML('afterend', `<div class="search-container"><input type="text" id="globalSearchInput" class="search-input" placeholder="Поиск по названию, автору или жанру..." autocomplete="off"><div id="globalSearchResults" class="search-results-dropdown" style="display:none;"></div></div>`);
    const si = document.getElementById('globalSearchInput'), rd = document.getElementById('globalSearchResults');
    if (!si) return;
    let st;
    si.addEventListener('input', e => { clearTimeout(st); const q = e.target.value.trim(); if (q.length < 1) { rd.style.display = 'none'; return; } rd.style.display = 'block'; rd.innerHTML = '<div class="search-loading">🔍 Поиск...</div>'; st = setTimeout(() => performSearch(q), 400); });
    document.addEventListener('click', e => { if (!si.contains(e.target) && !rd.contains(e.target)) rd.style.display = 'none'; });
    function performSearch(q) {
        if (!allBooks.length) { rd.innerHTML = '<div class="search-no-results">Книги загружаются...</div>'; return; }
        const lq = q.toLowerCase(), r = [];
        for (const b of allBooks) { const tm = b.title?.toLowerCase().includes(lq), am = b.author?.toLowerCase().includes(lq), gm = b.genre?.toLowerCase().includes(lq); if (tm || am || gm) { r.push({ id: b.id, title: b.title || 'Без названия', author: b.author || 'Неизвестен', matchType: tm ? '📖 в названии' : am ? '✍️ у автора' : '📂 в жанре' }); } }
        if (!r.length) { rd.innerHTML = '<div class="search-no-results">Ничего не найдено</div>'; return; }
        rd.innerHTML = `<div class="search-results-header">🔎 Найдено ${r.length} книг</div>${r.map(b => `<div class="search-result-item" data-book-id="${b.id}"><div class="search-result-title">📖 ${escapeHtml(b.title)}</div><div class="search-result-author">✍️ ${escapeHtml(b.author)}</div><div class="search-result-match">${b.matchType}</div></div>`).join('')}`;
        rd.querySelectorAll('.search-result-item').forEach(item => item.addEventListener('click', () => { openBook(parseInt(item.dataset.bookId)); rd.style.display = 'none'; si.value = ''; }));
    }
}

function showPage(page, addToHistory = true) {
    if (addToHistory && currentView !== page) { navigationHistory.push(currentView); if (navigationHistory.length > 10) navigationHistory.shift(); history.pushState({ page, navHistory: [...navigationHistory], menuOpen: false, feedbackOpen: false }, '', page === 'main' ? '/' : '/' + page); }
    if (DOM.mainPage) DOM.mainPage.style.display = 'none'; if (DOM.genresPage) DOM.genresPage.style.display = 'none';
    if (DOM.authorsPage) DOM.authorsPage.style.display = 'none'; if (DOM.favoritesPage) DOM.favoritesPage.style.display = 'none';
    switch(page) { case 'main': if(DOM.mainPage) DOM.mainPage.style.display='block'; break; case 'genres': if(DOM.genresPage) DOM.genresPage.style.display='block'; break; case 'authors': if(DOM.authorsPage) DOM.authorsPage.style.display='block'; break; case 'favorites': if(DOM.favoritesPage) DOM.favoritesPage.style.display='block'; break; }
    currentView = page;
}
function goBack() { if (navigationHistory.length > 0) { const pp = navigationHistory.pop(); showPage(pp, false); if (pp === 'main') history.replaceState({ page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false }, '', '/'); return true; } return false; }

document.addEventListener('DOMContentLoaded', async () => {
    cacheDomElements(); if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();
    showPage('main', false); setupTheme(); setupReader(); setupSideMenu(); setupCategoryPages(); updateConnectionStatus();
    const s = document.createElement('style'); s.textContent = '.reader-content{transition:padding 0.2s ease,line-height 0.2s ease;}'; document.head.appendChild(s);
    await loadAllBooks(); addSearchBar(); registerServiceWorker();
    window.addEventListener('popstate', (e) => {
        if (document.getElementById('feedbackModal')?.classList.contains('active')) { closeFeedback(false); return; }
        if (document.getElementById('commentsModal')?.classList.contains('active')) { closeComments(); return; }
        if (menuActive) { const sm = document.getElementById('sideMenu'), mo = document.getElementById('menuOverlay'); sm.classList.remove('active'); sm.style.right='-320px'; mo.classList.remove('active'); mo.style.opacity='0'; menuActive=false; document.body.style.overflow=''; setTimeout(()=>{if(!menuActive)mo.style.display='none';},300); if(currentView==='main') history.replaceState({page:'main',navHistory:[],menuOpen:false,feedbackOpen:false},'','/'); return; }
        if (DOM.readerWindow?.style.display === 'flex') { closeReader(false); return; }
        if (e.state?.page) { showPage(e.state.page, false); if(e.state.navHistory) navigationHistory = e.state.navHistory; if(e.state.page==='main') history.replaceState({page:'main',navHistory:[],menuOpen:false,feedbackOpen:false},'','/'); return; }
        if (navigationHistory.length > 0) goBack(); else { showPage('main', false); history.replaceState({page:'main',navHistory:[],menuOpen:false,feedbackOpen:false},'','/'); }
    });
    history.replaceState({ page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false }, '', '/');
});

function registerServiceWorker() { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').then(reg => { setInterval(() => reg.update(), 3600000); reg.addEventListener('updatefound', () => { const nw = reg.installing; nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) { localStorage.removeItem('cachedBooks'); localStorage.removeItem('cacheTimestamp'); window.location.reload(); } }); }); }).catch(() => {}); } }

async function loadAllBooks() { if (isLoading) return; isLoading = true; if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'block'; try { if (await loadFromCache()) { isLoading = false; if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none'; return; } let bf = []; try { const r = await fetch('books-list.json?t=' + Date.now()); if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length > 0) bf = d; } } catch(e) {} if (!bf.length) bf = DEFAULT_BOOK_FILES; allBooks = []; for (let i = 0; i < bf.length; i++) { try { const r = await fetch(bf[i] + '?t=' + Date.now()); if (r.ok) { const d = await r.json(); if (d?.title && d.pages) { d.id = i + 1; allBooks.push(d); } } } catch(e) {} } if (allBooks.length > 0) { renderBooks(allBooks); try { localStorage.setItem('cachedBooks', JSON.stringify(allBooks)); localStorage.setItem('cacheTimestamp', Date.now().toString()); } catch(e) {} } } catch(e) { if (!await loadFromCache() && DOM.errorMessage) { DOM.errorMessage.style.display = 'block'; DOM.errorMessage.innerHTML = '<h3>Ошибка загрузки</h3><button id="retryButton" class="btn btn-read">Повторить</button>'; document.getElementById('retryButton')?.addEventListener('click', retryLoading); } } finally { isLoading = false; if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none'; } }
async function loadFromCache() { try { const c = localStorage.getItem('cachedBooks'), t = localStorage.getItem('cacheTimestamp'); if (c && t && (Date.now() - parseInt(t) < 86400000)) { allBooks = JSON.parse(c); if (allBooks?.length > 0) { renderBooks(allBooks); return true; } } } catch(e) {} return false; }

function renderBooks(books, targetGrid) { const grid = targetGrid || DOM.booksGrid; if (!grid) return; if (!books?.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;">Книги не найдены</div>'; return; } const f = document.createDocumentFragment(); for (const b of books) { const card = document.createElement('div'); card.className = 'book-card'; card.innerHTML = `<div class="book-cover">${escapeHtml(b.cover || b.title)}</div><div class="book-title">${escapeHtml(b.title)}</div><div class="book-meta"><p><strong>Автор:</strong> ${escapeHtml(b.author||'Неизвестен')}</p><p><strong>Жанр:</strong> ${escapeHtml(b.genre||'Без жанра')}</p><p><strong>Год:</strong> ${escapeHtml(b.year||'-')}</p><p><strong>Страниц:</strong> ${b.pages?.length||0}</p></div><div class="book-buttons"><button class="btn btn-read">📖 Читать</button><button class="btn btn-favorite">⭐</button></div><button class="btn btn-comments-card">💬 Комментарии</button>`; card.querySelector('.btn-read').addEventListener('click', () => openBook(b.id)); card.querySelector('.btn-favorite').addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(b.id, card.querySelector('.btn-favorite')); }); card.querySelector('.btn-comments-card').addEventListener('click', (e) => { e.stopPropagation(); openComments(b.id); }); if (isFavorite(b.id)) { card.querySelector('.btn-favorite').classList.add('active'); card.querySelector('.btn-favorite').textContent = '★'; } f.appendChild(card); } grid.innerHTML = ''; grid.appendChild(f); }

window.openBook = function(bookId) { const b = allBooks.find(x => x.id === bookId); if (!b?.pages?.length) return; history.pushState({ page: 'reader', bookId, navHistory: [...navigationHistory] }, '', '/book/' + bookId); currentBook = JSON.parse(JSON.stringify(b)); currentPage = getReadingProgress(bookId); if (currentPage > currentBook.pages.length) currentPage = 1; fontSize = getDeviceType() === 'mobile' ? 14 : getDeviceType() === 'tablet' ? 16 : 18; if (DOM.readerTitle) DOM.readerTitle.textContent = currentBook.title; if (DOM.readerContent) { DOM.readerContent.innerHTML = currentBook.pages[currentPage - 1]; DOM.readerContent.style.fontSize = fontSize + 'px'; DOM.readerContent.scrollTop = 0; } if (DOM.currentPage) DOM.currentPage.textContent = currentPage; if (DOM.totalPages) DOM.totalPages.textContent = currentBook.pages.length; if (DOM.readerWindow) DOM.readerWindow.style.display = 'flex'; if (DOM.overlay) DOM.overlay.style.display = 'block'; applyDeviceLayout(); };

function setupCategoryPages() { document.getElementById('backFromGenres')?.addEventListener('click', goBack); document.getElementById('backFromAuthors')?.addEventListener('click', goBack); document.getElementById('backFromFavorites')?.addEventListener('click', goBack); }

function showGenresPage() { if (!allBooks.length) return; const m = new Map(); allBooks.forEach(b => { const g = b.genre || 'Без жанра'; if (!m.has(g)) m.set(g, []); m.get(g).push(b); }); const f = document.createDocumentFragment(); m.forEach((books, genre) => { const btn = document.createElement('button'); btn.className = 'category-item'; btn.innerHTML = `<span>${escapeHtml(genre)}</span><span class="count">${books.length} кн.</span>`; btn.addEventListener('click', () => { renderBooks(allBooks.filter(b => (b.genre||'Без жанра')===genre)); showPage('main'); scrollTo(0,0); }); f.appendChild(btn); }); DOM.genresList.innerHTML = ''; DOM.genresList.appendChild(f); showPage('genres'); }
function showAuthorsPage() { if (!allBooks.length) return; const m = new Map(); allBooks.forEach(b => { const a = b.author || 'Неизвестен'; if (!m.has(a)) m.set(a, []); m.get(a).push(b); }); const f = document.createDocumentFragment(); [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([author, books]) => { const btn = document.createElement('button'); btn.className = 'category-item'; btn.innerHTML = `<span>${escapeHtml(author)}</span><span class="count">${books.length} кн.</span>`; btn.addEventListener('click', () => { renderBooks(allBooks.filter(b => (b.author||'Неизвестен')===author)); showPage('main'); scrollTo(0,0); }); f.appendChild(btn); }); DOM.authorsList.innerHTML = ''; DOM.authorsList.appendChild(f); showPage('authors'); }

function getFavorites() { try { return JSON.parse(localStorage.getItem('favorites')||'[]'); } catch(e) { return []; } }
function saveFavorites(f) { localStorage.setItem('favorites', JSON.stringify(f)); }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id, btn) { const f = getFavorites(); const i = f.indexOf(id); if (i > -1) { f.splice(i,1); if(btn){btn.classList.remove('active');btn.textContent='⭐';} } else { f.push(id); if(btn){btn.classList.add('active');btn.textContent='★';} } saveFavorites(f); }
function showFavorites() { const fav = getFavorites(); const grid = document.getElementById('favoritesBooksGrid'); if (!grid) return; if (!fav.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;">⭐ Пока нет избранных книг</div>'; } else renderBooks(allBooks.filter(b => fav.includes(b.id)), grid); showPage('favorites'); }

function setupSideMenu() {
    const burger = document.getElementById('burgerBtn'), menu = document.getElementById('sideMenu'), overlay = document.getElementById('menuOverlay');
    if (!burger || !menu) return;
    function open() { menu.classList.add('active'); menu.style.right='0'; overlay.classList.add('active'); overlay.style.display='block'; overlay.style.opacity='1'; menuActive=true; document.body.style.overflow='hidden'; history.pushState({ page: currentView, menuOpen: true }, '', '/menu'); }
    function close(h) { menu.classList.remove('active'); menu.style.right='-320px'; overlay.classList.remove('active'); overlay.style.opacity='0'; menuActive=false; document.body.style.overflow=''; setTimeout(()=>{if(!menuActive)overlay.style.display='none';},300); if(h && history.state?.menuOpen) history.back(); }
    burger.addEventListener('click', open); document.getElementById('sideMenuClose').addEventListener('click', ()=>close(true)); overlay.addEventListener('click', ()=>close(true)); document.addEventListener('keydown', e => { if(e.key==='Escape'&&menuActive) close(true); });
    let sx=0; document.addEventListener('touchstart', e => { if(!menuActive) sx=e.touches[0].clientX; }, {passive:true}); document.addEventListener('touchend', e => { if(menuActive) return; if(sx > innerWidth-40 && sx - e.changedTouches[0].clientX > 50) open(); });
    let msx=0, mcx=0, sw=false; menu.addEventListener('touchstart', e => { if(!menuActive) return; msx=e.touches[0].clientX; mcx=msx; sw=true; }, {passive:true}); menu.addEventListener('touchmove', e => { if(!sw||!menuActive) return; mcx=e.touches[0].clientX; const d=mcx-msx; if(d>0){ menu.style.right='-'+Math.min(d,300)+'px'; overlay.style.opacity=1-Math.min(d/300,1); } }, {passive:true}); menu.addEventListener('touchend', () => { if(!sw||!menuActive){sw=false;return;} sw=false; if(mcx-msx>80) close(true); else { menu.style.right='0'; overlay.style.opacity='1'; } });
    document.getElementById('menuGenres').addEventListener('click', ()=>{close(false);setTimeout(showGenresPage,300);}); document.getElementById('menuAuthors').addEventListener('click', ()=>{close(false);setTimeout(showAuthorsPage,300);}); document.getElementById('menuFavorites').addEventListener('click', ()=>{close(false);setTimeout(showFavorites,300);}); document.getElementById('menuFeedback').addEventListener('click', ()=>{close(false);setTimeout(openFeedback,300);}); document.getElementById('menuAll').addEventListener('click', ()=>{close(false);setTimeout(()=>{renderBooks(allBooks);showPage('main');scrollTo(0,0);},300);});
}

function openFeedback() { const m = document.getElementById('feedbackModal'); if(!m) return; history.pushState({ page: currentView, feedbackOpen: true }, '', '/feedback'); document.getElementById('feedbackForm').innerHTML = '<div class="feedback-field"><label>Имя</label><input id="feedbackName" placeholder="Необязательно"></div><div class="feedback-field"><label>Тема</label><select id="feedbackTopic"><option value="bug">🐛 Ошибка</option><option value="feature">💡 Предложение</option><option value="other">💬 Другое</option></select></div><div class="feedback-field"><label>Сообщение</label><textarea id="feedbackMessage" rows="5" required></textarea></div><button type="submit" class="btn-submit">📨 Отправить</button>'; m.classList.add('active'); document.body.style.overflow='hidden'; document.getElementById('feedbackClose').onclick = ()=>closeFeedback(true); document.getElementById('feedbackOverlay').onclick = ()=>closeFeedback(true); document.getElementById('feedbackForm').onsubmit = submitFeedback; }
function closeFeedback(h) { const m = document.getElementById('feedbackModal'); if(!m) return; m.classList.remove('active'); document.body.style.overflow=''; if(h && history.state?.feedbackOpen) history.back(); }
function submitFeedback(e) { e.preventDefault(); const name = document.getElementById('feedbackName').value || 'Аноним', topic = document.getElementById('feedbackTopic').value, msg = document.getElementById('feedbackMessage').value, topics = {bug:'Ошибка',feature:'Предложение',other:'Другое'}, subj = `[Библиотека] ${topics[topic]} от ${name}`, body = `Имя: ${name}\nТема: ${topics[topic]}\n\n${msg}`; document.getElementById('feedbackForm').innerHTML = '<div class="feedback-success"><div class="success-icon">✅</div><h3>Спасибо!</h3><p>Сообщение отправлено.</p><button class="btn-submit" onclick="closeFeedback(true)" style="margin-top:15px">Закрыть</button></div>'; const mob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); if(mob) location.href = `mailto:cheburekus2012@gmail.com?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`; else open(`https://mail.google.com/mail/?view=cm&fs=1&to=cheburekus2012@gmail.com&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`, '_blank'); }

function setupTheme() { const t = localStorage.getItem('selectedTheme')||'light'; document.body.classList.add(t+'-theme'); updateThemeIcon(t); document.getElementById('themeToggle').addEventListener('click', () => { if(document.body.classList.contains('light-theme')) { document.body.classList.replace('light-theme','dark-theme'); localStorage.setItem('selectedTheme','dark'); updateThemeIcon('dark'); } else { document.body.classList.replace('dark-theme','light-theme'); localStorage.setItem('selectedTheme','light'); updateThemeIcon('light'); } }); }
function updateThemeIcon(t) { const btn = document.getElementById('themeToggle'); if(!btn) return; btn.querySelector('.theme-icon-light').style.display = t==='dark'?'none':'inline'; btn.querySelector('.theme-icon-dark').style.display = t==='dark'?'inline':'none'; }

function setupReader() {
    const prev = () => { if(currentBook&&currentPage>1){currentPage--;updateReaderContent();saveReadingProgress(currentBook.id,currentPage);} }, next = () => { if(currentBook&&currentPage<currentBook.pages.length){currentPage++;updateReaderContent();saveReadingProgress(currentBook.id,currentPage);} };
    DOM.prevPage?.addEventListener('click', prev); DOM.nextPage?.addEventListener('click', next); DOM.fullscreenPrevBtn?.addEventListener('click', prev); DOM.fullscreenNextBtn?.addEventListener('click', next);
    DOM.closeReader?.addEventListener('click', ()=>closeReader(true)); DOM.overlay?.addEventListener('click', ()=>closeReader(true)); DOM.exitFullscreenBtn?.addEventListener('click', toggleFullscreen); DOM.fullscreenBtn?.addEventListener('click', toggleFullscreen);
    DOM.fontPlus?.addEventListener('click', ()=>{fontSize=Math.min(fontSize+2,30);if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px';}); DOM.fontMinus?.addEventListener('click', ()=>{fontSize=Math.max(fontSize-2,14);if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px';});
    document.addEventListener('keydown', e => { if(!DOM.readerWindow||DOM.readerWindow.style.display!=='flex') return; if(e.key==='Escape'){ if(isFullscreen)toggleFullscreen(); else closeReader(true); } else if(e.key==='ArrowLeft'||e.key==='PageUp'){ e.preventDefault(); prev(); } else if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); next(); } else if(e.key==='f'||e.key==='F'){ e.preventDefault(); toggleFullscreen(); } else if(e.key==='+'||e.key==='='){ e.preventDefault(); fontSize=Math.min(fontSize+2,30); if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px'; } else if(e.key==='-'||e.key==='_'){ e.preventDefault(); fontSize=Math.max(fontSize-2,14); if(DOM.readerContent)DOM.readerContent.style.fontSize=fontSize+'px'; } });
}
function updateReaderContent() { if(!currentBook||!DOM.readerContent) return; DOM.readerContent.innerHTML = currentBook.pages[currentPage-1]; DOM.readerContent.style.fontSize = fontSize+'px'; DOM.readerContent.scrollTop = 0; if(DOM.currentPage) DOM.currentPage.textContent = currentPage; }
window.toggleFullscreen = function() { if(!DOM.readerWindow) return; if(!isFullscreen){ DOM.readerWindow.classList.add('fullscreen'); if(DOM.overlay)DOM.overlay.style.display='none'; isFullscreen=true; } else { DOM.readerWindow.classList.remove('fullscreen'); if(DOM.overlay)DOM.overlay.style.display='block'; isFullscreen=false; applyDeviceLayout(); } };
window.closeReader = function(h=true) { if(currentBook?.id) saveReadingProgress(currentBook.id, currentPage); if(isFullscreen) toggleFullscreen(); if(DOM.readerWindow) DOM.readerWindow.style.display='none'; if(DOM.overlay) DOM.overlay.style.display='none'; if(h) history.back(); };
window.retryLoading = function() { if(DOM.errorMessage) DOM.errorMessage.style.display='none'; localStorage.removeItem('cachedBooks'); localStorage.removeItem('cacheTimestamp'); allBooks = []; loadAllBooks(); };

function updateConnectionStatus() { let d = document.getElementById('connection-status'); if(!d) { d = document.createElement('div'); d.id = 'connection-status'; d.style.cssText = 'position:fixed;bottom:10px;right:16px;padding:6px 12px;border-radius:20px;font-size:12px;z-index:999;background:rgba(0,0,0,0.7);color:white;pointer-events:none;'; document.body.appendChild(d); } d.textContent = navigator.onLine ? '● Онлайн' : '○ Офлайн'; d.style.background = navigator.onLine ? 'rgba(46,125,50,0.9)' : 'rgba(128,128,128,0.9)'; }
window.addEventListener('online', updateConnectionStatus); window.addEventListener('offline', updateConnectionStatus);
let resizeTimer; window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { cachedDeviceType = null; if(currentBook && DOM.readerWindow?.style.display==='flex') { applyDeviceLayout(); if(currentPage > currentBook.pages.length) { currentPage = currentBook.pages.length; updateReaderContent(); saveReadingProgress(currentBook.id, currentPage); } } }, 150); });
window.loadAllBooks = loadAllBooks;
