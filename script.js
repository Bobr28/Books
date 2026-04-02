// ========== 🚀 ОПТИМИЗИРОВАННАЯ ВЕРСИЯ ==========
// =================================================

// Кэш для DOM элементов
const DOM = {};
const CACHE = {
    books: null,
    timestamp: null,
    bookFiles: null
};

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

// Быстрое разбиение на страницы (оптимизированное)
function splitHtmlIntoPages(htmlContent, charsPerPage) {
    if (htmlContent.length <= charsPerPage) return [htmlContent];
    
    // Удаляем лишние пробелы для точного подсчета
    const cleanText = htmlContent.replace(/\s+/g, ' ');
    const totalChars = cleanText.length;
    
    if (totalChars <= charsPerPage) return [htmlContent];
    
    // Быстрое разбиение по словам
    const pages = [];
    let start = 0;
    
    while (start < totalChars) {
        let end = start + charsPerPage;
        if (end >= totalChars) {
            pages.push(cleanText.substring(start));
            break;
        }
        
        // Ищем пробел для чистого разрыва
        while (end > start && cleanText[end] !== ' ') end--;
        if (end === start) end = start + charsPerPage;
        
        pages.push(cleanText.substring(start, end));
        start = end;
    }
    
    return pages;
}

// Применение стилей устройства
function applyDeviceStyles() {
    const config = DEVICE_CONFIG[getDeviceType()];
    if (DOM.readerContent) {
        DOM.readerContent.style.cssText = `font-size:${config.fontSize}px;line-height:${config.lineHeight};padding:${config.padding}px;`;
    }
}

// Сохранение прогресса (оптимизированное)
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

// ДЕФОЛТНЫЙ СПИСОК КНИГ (если books-list.json не загрузится)
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
    
    // Загружаем книги
    await loadAllBooks();
});

// Быстрая загрузка книг
async function loadAllBooks() {
    if (isLoading) return;
    isLoading = true;
    
    if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'block';
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
    if (DOM.booksGrid) DOM.booksGrid.innerHTML = '';
    
    try {
        // 1. Сначала пытаемся загрузить из кэша
        if (await loadFromCache()) {
            isLoading = false;
            if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
            return;
        }
        
        // 2. Пытаемся загрузить список файлов из books-list.json
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
            console.warn('⚠️ Не удалось загрузить books-list.json, используем список по умолчанию');
        }
        
        // 3. Если books-list.json не загрузился, используем список по умолчанию
        if (!listLoaded || bookFiles.length === 0) {
            bookFiles = DEFAULT_BOOK_FILES;
            console.log('📚 Используем список книг по умолчанию:', bookFiles);
        }
        
        // 4. Загружаем книги параллельно
        const bookPromises = bookFiles.map(async (filename, index) => {
            try {
                // Пробуем загрузить с обходом кэша
                const res = await fetch(filename + '?t=' + Date.now());
                if (!res.ok) {
                    console.warn(`❌ Книга ${filename} не найдена (${res.status})`);
                    return null;
                }
                const data = await res.json();
                if (data.title && data.author && data.pages && data.pages.length > 0) {
                    data.id = index + 1;
                    console.log(`✅ Загружена книга ${index + 1}: ${data.title}`);
                    return data;
                } else {
                    console.warn(`❌ Книга ${filename} имеет неверную структуру`);
                    return null;
                }
            } catch(e) {
                console.warn(`❌ Ошибка загрузки ${filename}:`, e.message);
                return null;
            }
        });
        
        const results = await Promise.all(bookPromises);
        allBooks = results.filter(b => b !== null);
        
        console.log(`📊 Итого загружено книг: ${allBooks.length} из ${bookFiles.length}`);
        
        // 5. Если книги загрузились - отображаем
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            
            // Сохраняем в кэш
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cachedBookFiles', JSON.stringify(bookFiles));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
            } catch(e) {}
        } else {
            // 6. Если ни одной книги не загрузилось - показываем ошибку
            throw new Error('Не удалось загрузить ни одной книги');
        }
        
    } catch(error) {
        console.error('❌ Критическая ошибка:', error);
        
        // Последняя попытка - загрузить из кэша
        const cacheLoaded = await loadFromCache();
        
        if (!cacheLoaded && DOM.errorMessage) {
            DOM.errorMessage.style.display = 'block';
            DOM.errorMessage.innerHTML = `
                <h3>❌ Ошибка загрузки книг</h3>
                <p>Не удалось загрузить книги. Проверьте наличие файлов:</p>
                <ul style="text-align:left;display:inline-block;margin:10px 0;">
                    <li>books-list.json (список книг)</li>
                    <li>book1.json, book2.json и т.д. (сами книги)</li>
                </ul>
                <p style="margin-top:15px;">
                    <button onclick="retryLoading()" class="btn btn-read">🔄 Повторить</button>
                    <button onclick="loadDefaultBooks()" class="btn btn-details" style="margin-left:10px;">📚 Загрузить по умолчанию</button>
                </p>
            `;
        }
    } finally {
        isLoading = false;
        if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
    }
}

// Загрузка книг по умолчанию (без books-list.json)
window.loadDefaultBooks = async function() {
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
    if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'block';
    
    try {
        const bookPromises = DEFAULT_BOOK_FILES.map(async (filename, index) => {
            try {
                const res = await fetch(filename + '?t=' + Date.now());
                if (!res.ok) return null;
                const data = await res.json();
                if (data.title && data.author && data.pages) {
                    data.id = index + 1;
                    return data;
                }
                return null;
            } catch(e) {
                return null;
            }
        });
        
        const results = await Promise.all(bookPromises);
        allBooks = results.filter(b => b !== null);
        
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            // Сохраняем в кэш
            localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
            localStorage.setItem('cacheTimestamp', Date.now().toString());
        } else {
            throw new Error('Нет книг');
        }
    } catch(e) {
        alert('Не удалось загрузить книги. Убедитесь, что файлы book1.json...book8.json существуют.');
    } finally {
        if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
    }
};

// Загрузка из кэша
async function loadFromCache() {
    try {
        const cached = localStorage.getItem('cachedBooks');
        const timestamp = localStorage.getItem('cacheTimestamp');
        
        // Используем кэш если ему меньше 24 часов
        if (cached && timestamp && (Date.now() - parseInt(timestamp) < 86400000)) {
            allBooks = JSON.parse(cached);
            if (allBooks.length > 0) {
                renderBooks(allBooks);
                console.log(`⚡ Загружено из кэша: ${allBooks.length} книг`);
                return true;
            }
        }
    } catch(e) {}
    return false;
}

// Быстрая отрисовка книг (с использованием DocumentFragment)
function renderBooks(books) {
    if (!DOM.booksGrid) return;
    
    const fragment = document.createDocumentFragment();
    const len = books.length;
    
    for (let i = 0; i < len; i++) {
        const book = books[i];
        const card = document.createElement('div');
        card.className = 'book-card';
        card.setAttribute('data-id', book.id);
        card.innerHTML = `<div class="book-cover">${escapeHtml(book.cover || book.title)}</div>
                         <div class="book-title">${escapeHtml(book.title)}</div>
                         <div class="book-meta"><p><strong>Автор:</strong> ${escapeHtml(book.author)}</p>
                         <p><strong>Год:</strong> ${escapeHtml(book.year || 'Не указан')}</p>
                         <p><strong>Страниц:</strong> ${book.pages ? book.pages.length : 0}</p></div>
                         <div class="book-buttons"><button class="btn btn-read">📖 Читать</button>
                         <button class="btn btn-details">ℹ️ Подробнее</button></div>`;
        
        // Привязываем события сразу
        const readBtn = card.querySelector('.btn-read');
        const detailsBtn = card.querySelector('.btn-details');
        
        readBtn.onclick = (function(b) { return () => openBook(b.id); })(book);
        detailsBtn.onclick = (function(b) { return () => showBookDetails(b.id); })(book);
        
        fragment.appendChild(card);
    }
    
    DOM.booksGrid.innerHTML = '';
    DOM.booksGrid.appendChild(fragment);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// Открытие книги (оптимизированное)
window.openBook = function(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book || !book.pages?.length) return alert('Ошибка: книга не найдена');
    
    currentBook = JSON.parse(JSON.stringify(book));
    
    if (!currentBook.originalPages) {
        currentBook.originalPages = [...currentBook.pages];
    }
    
    const device = getDeviceType();
    const config = DEVICE_CONFIG[device];
    
    // Быстрая репагинация
    if (currentBook.originalPages.some(p => p.length > config.charsPerPage)) {
        const newPages = [];
        for (let i = 0; i < currentBook.originalPages.length; i++) {
            const split = splitHtmlIntoPages(currentBook.originalPages[i], config.charsPerPage);
            for (let j = 0; j < split.length; j++) newPages.push(split[j]);
        }
        currentBook.pages = newPages;
    }
    
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
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    const preview = book.pages?.[0]?.replace(/<[^>]*>/g, '').substring(0, 150) || '';
    alert(`${book.title}\n\nАвтор: ${book.author}\nГод: ${book.year || 'Не указан'}\nСтраниц: ${book.pages?.length || 0}\n\n${preview}...`);
}

// Настройка темы
function setupTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    document.body.classList.add(savedTheme + '-theme');
    
    const themeLight = document.getElementById('theme-light');
    const themeDark = document.getElementById('theme-dark');
    
    if (themeLight) {
        themeLight.onclick = () => {
            document.body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('selectedTheme', 'light');
            themeLight.classList.add('active');
            if (themeDark) themeDark.classList.remove('active');
        };
        if (savedTheme === 'light') themeLight.classList.add('active');
    }
    
    if (themeDark) {
        themeDark.onclick = () => {
            document.body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('selectedTheme', 'dark');
            themeDark.classList.add('active');
            if (themeLight) themeLight.classList.remove('active');
        };
        if (savedTheme === 'dark') themeDark.classList.add('active');
    }
}

// Настройка читалки (оптимизированные обработчики)
function setupReader() {
    const prevPage = () => {
        if (currentBook && currentPage > 1) {
            currentPage--;
            updateReaderContent();
            saveReadingProgress(currentBook.id, currentPage);
        }
    };
    
    const nextPage = () => {
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
    
    if (DOM.fontPlus) DOM.fontPlus.onclick = () => {
        fontSize = Math.min(fontSize + 2, 30);
        if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
    };
    
    if (DOM.fontMinus) DOM.fontMinus.onclick = () => {
        fontSize = Math.max(fontSize - 2, 14);
        if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
    };
    
    // Горячие клавиши (один обработчик)
    document.addEventListener('keydown', (e) => {
        if (DOM.readerWindow?.style.display !== 'flex') return;
        
        switch(e.key) {
            case 'Escape': isFullscreen ? toggleFullscreen() : closeReader(); break;
            case 'ArrowLeft': case 'PageUp': e.preventDefault(); prevPage(); break;
            case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); nextPage(); break;
            case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
            case '+': e.preventDefault(); fontSize = Math.min(fontSize + 2, 30); if(DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px'; break;
            case '-': e.preventDefault(); fontSize = Math.max(fontSize - 2, 14); if(DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px'; break;
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
    if (currentBook?.id) saveReadingProgress(currentBook.id, currentPage);
    if (isFullscreen) toggleFullscreen();
    if (DOM.readerWindow) DOM.readerWindow.style.display = 'none';
    if (DOM.overlay) DOM.overlay.style.display = 'none';
    if (DOM.exitFullscreenBtn) DOM.exitFullscreenBtn.style.display = 'none';
    if (DOM.fullscreenPrevBtn) DOM.fullscreenPrevBtn.style.display = 'none';
    if (DOM.fullscreenNextBtn) DOM.fullscreenNextBtn.style.display = 'none';
};

window.retryLoading = function() {
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';
    // Очищаем кэш перед повторной попыткой
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

// Следим за изменением размера экрана (с debounce)
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        cachedDeviceType = null; // Сброс кэша устройства
        if (currentBook && DOM.readerWindow?.style.display === 'flex') {
            const oldPage = currentPage;
            const config = DEVICE_CONFIG[getDeviceType()];
            
            const newPages = [];
            for (let i = 0; i < currentBook.originalPages.length; i++) {
                const split = splitHtmlIntoPages(currentBook.originalPages[i], config.charsPerPage);
                for (let j = 0; j < split.length; j++) newPages.push(split[j]);
            }
            currentBook.pages = newPages;
            
            currentPage = Math.min(oldPage, currentBook.pages.length);
            updateReaderContent();
            if (DOM.totalPages) DOM.totalPages.textContent = currentBook.pages.length;
            saveReadingProgress(currentBook.id, currentPage);
            applyDeviceStyles();
        }
    }, 150);
});

window.loadAllBooks = loadAllBooks;
