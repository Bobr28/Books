// ============================================================
//  КОНФИГУРАЦИЯ И ГЛОБАЛЬНЫЕ КОНСТАНТЫ
// ============================================================

// Список файлов книг, используемый по умолчанию, если books-list.json недоступен
const DEFAULT_BOOK_FILES = [
    'book1.json', 'book2.json', 'book3.json', 'book4.json',
    'book5.json', 'book6.json', 'book7.json', 'book8.json'
];

// Настройки отображения для разных типов устройств (адаптивная верстка)
const DEVICE_CONFIG = {
    mobile:  { lineHeight: 1.5, padding: 15 },
    tablet:  { lineHeight: 1.6, padding: 25 },
    desktop: { lineHeight: 1.8, padding: 40 }
};

// Эндпоинт Google Apps Script для работы с комментариями
const COMMENTS_API_URL = 'https://script.google.com/macros/s/AKfycbxk-JzUsqjqTFKjgXdKM5Fxr7JCdoyfQhJyhHIP83WNsxkpFDB4RSgiIWiC0EFxYmpQ/exec';

// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================================

// Хранилище всех загруженных книг
let allBooks = [];

// Данные о книге, открытой в читалке
let currentBook = null;

// Текущая страница в читалке и размер шрифта
let currentPage = 1;
let fontSize = 18;

// Флаги состояния интерфейса
let isLoading = false;      // Идет ли загрузка книг
let menuActive = false;     // Открыто ли боковое меню
let isFullscreen = false;   // Включен ли полноэкранный режим в читалке
let currentView = 'main';   // Текущая активная страница (main, genres, authors, favorites)

// Кэш DOM-элементов для быстрого доступа (заполняется при загрузке)
const DOM = {};

// Стек истории навигации для реализации кнопки "назад" внутри приложения
let navigationHistory = [];

// Кэш для определения типа устройства
let cachedDeviceType = null;
let cachedWidth = 0;

// ============================================================
//  УТИЛИТЫ (ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ)
// ============================================================

/**
 * Безопасная обработка строк для вставки в HTML.
 * Предотвращает XSS-атаки, заменяя спецсимволы на HTML-сущности.
 */
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

/**
 * Определяет тип устройства (mobile, tablet, desktop) с кэшированием.
 * Используется для адаптации интерфейса читалки.
 */
function getDeviceType() {
    const width = window.innerWidth;

    // Возвращаем кэшированное значение, если ширина не изменилась
    if (width === cachedWidth && cachedDeviceType) return cachedDeviceType;

    cachedWidth = width;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (width <= 480 || (isMobile && width <= 768)) cachedDeviceType = 'mobile';
    else if (width <= 768) cachedDeviceType = 'tablet';
    else cachedDeviceType = 'desktop';

    return cachedDeviceType;
}

/**
 * Применяет настройки отображения (отступы, межстрочный интервал)
 * в зависимости от типа устройства.
 */
function applyDeviceLayout() {
    if (!DOM.readerContent) return;
    const config = DEVICE_CONFIG[getDeviceType()];
    DOM.readerContent.style.lineHeight = config.lineHeight;
    DOM.readerContent.style.padding = config.padding + 'px';
}

/**
 * Форматирует дату комментария в относительном виде ("5 мин. назад", "вчера" и т.д.)
 */
function formatDate(dateString) {
    const d = new Date(dateString);
    const n = new Date();
    const diff = n - d;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;

    return d.toLocaleDateString('ru-RU');
}

// ============================================================
//  РАБОТА С ИЗБРАННЫМ
// ============================================================

function getFavorites() {
    try { return JSON.parse(localStorage.getItem('favorites') || '[]'); }
    catch(e) { return []; }
}

function saveFavorites(favorites) {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function isFavorite(bookId) {
    return getFavorites().includes(bookId);
}

function toggleFavorite(bookId, buttonElement) {
    const favorites = getFavorites();
    const index = favorites.indexOf(bookId);

    if (index > -1) {
        // Удаляем из избранного
        favorites.splice(index, 1);
        if (buttonElement) {
            buttonElement.classList.remove('active');
            buttonElement.textContent = '⭐';
        }
    } else {
        // Добавляем в избранное
        favorites.push(bookId);
        if (buttonElement) {
            buttonElement.classList.add('active');
            buttonElement.textContent = '★';
        }
    }
    saveFavorites(favorites);
}

// ============================================================
//  СОХРАНЕНИЕ ПРОГРЕССА ЧТЕНИЯ
// ============================================================

function saveReadingProgress(bookId, page) {
    if (!bookId) return;
    try {
        const progress = JSON.parse(localStorage.getItem('readingProgress') || '{}');
        if (progress[bookId] !== page) {
            progress[bookId] = page;
            localStorage.setItem('readingProgress', JSON.stringify(progress));
        }
    } catch(e) {
        console.error('Ошибка сохранения прогресса чтения:', e);
    }
}

function getReadingProgress(bookId) {
    if (!bookId) return 1;
    try {
        return JSON.parse(localStorage.getItem('readingProgress') || '{}')[bookId] || 1;
    } catch(e) {
        return 1;
    }
}

// ============================================================
//  УПРАВЛЕНИЕ НАВИГАЦИЕЙ
// ============================================================

/**
 * Переключает видимую страницу приложения.
 * @param {string} page - Идентификатор страницы (main, genres, authors, favorites)
 * @param {boolean} addToHistory - Добавлять ли переход в историю навигации
 */
function showPage(page, addToHistory = true) {
    // Сохраняем текущую страницу в историю для кнопки "назад"
    if (addToHistory && currentView !== page) {
        navigationHistory.push(currentView);
        // Ограничиваем размер истории
        if (navigationHistory.length > 10) navigationHistory.shift();

        // Обновляем URL без перезагрузки
        history.pushState(
            { page, navHistory: [...navigationHistory], menuOpen: false, feedbackOpen: false },
            '',
            page === 'main' ? '/' : '/' + page
        );
    }

    // Скрываем все страницы
    if (DOM.mainPage) DOM.mainPage.style.display = 'none';
    if (DOM.genresPage) DOM.genresPage.style.display = 'none';
    if (DOM.authorsPage) DOM.authorsPage.style.display = 'none';
    if (DOM.favoritesPage) DOM.favoritesPage.style.display = 'none';

    // Показываем нужную
    switch(page) {
        case 'main':      if(DOM.mainPage) DOM.mainPage.style.display = 'block'; break;
        case 'genres':    if(DOM.genresPage) DOM.genresPage.style.display = 'block'; break;
        case 'authors':   if(DOM.authorsPage) DOM.authorsPage.style.display = 'block'; break;
        case 'favorites': if(DOM.favoritesPage) DOM.favoritesPage.style.display = 'block'; break;
    }

    currentView = page;
    console.log(`📄 Страница: ${page}`);
}

/**
 * Возвращает на предыдущую страницу навигации.
 * @returns {boolean} true, если переход выполнен
 */
function goBack() {
    if (navigationHistory.length > 0) {
        const previousPage = navigationHistory.pop();
        showPage(previousPage, false);

        // Если вернулись на главную, очищаем историю URL
        if (previousPage === 'main') {
            history.replaceState(
                { page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false },
                '',
                '/'
            );
        }
        return true;
    }
    return false;
}

// ============================================================
//  ПОИСК ПО КНИГАМ
// ============================================================

function addSearchBar() {
    const titleElement = document.querySelector('#mainPage h2');
    if (!titleElement || document.getElementById('globalSearchInput')) return;

    // Добавляем HTML поиска после заголовка
    titleElement.insertAdjacentHTML('afterend', `
        <div class="search-container">
            <input type="text"
                   id="globalSearchInput"
                   class="search-input"
                   placeholder="Поиск по названию, автору или жанру..."
                   autocomplete="off">
            <div id="globalSearchResults"
                 class="search-results-dropdown"
                 style="display:none;">
            </div>
        </div>
    `);

    const searchInput = document.getElementById('globalSearchInput');
    const resultsDropdown = document.getElementById('globalSearchResults');
    if (!searchInput) return;

    let searchTimeout;

    // Обработчик ввода с задержкой (debounce)
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 1) {
            resultsDropdown.style.display = 'none';
            return;
        }

        resultsDropdown.style.display = 'block';
        resultsDropdown.innerHTML = '<div class="search-loading">🔍 Поиск...</div>';

        searchTimeout = setTimeout(() => performSearch(query), 400);
    });

    // Закрытие выпадающего списка при клике вне его
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
            resultsDropdown.style.display = 'none';
        }
    });

    /**
     * Выполняет поиск по загруженным книгам и отображает результаты.
     */
    function performSearch(query) {
        if (!allBooks.length) {
            resultsDropdown.innerHTML = '<div class="search-no-results">Книги загружаются...</div>';
            return;
        }

        const lowerQuery = query.toLowerCase();
        const results = [];

        // Ищем совпадения по названию, автору и жанру
        for (const book of allBooks) {
            const titleMatch = book.title?.toLowerCase().includes(lowerQuery);
            const authorMatch = book.author?.toLowerCase().includes(lowerQuery);
            const genreMatch = book.genre?.toLowerCase().includes(lowerQuery);

            if (titleMatch || authorMatch || genreMatch) {
                results.push({
                    id: book.id,
                    title: book.title || 'Без названия',
                    author: book.author || 'Неизвестен',
                    matchType: titleMatch ? '📖 в названии' :
                               authorMatch ? '✍️ у автора' :
                               '📂 в жанре'
                });
            }
        }

        if (!results.length) {
            resultsDropdown.innerHTML = '<div class="search-no-results">Ничего не найдено</div>';
            return;
        }

        // Рендерим результаты
        resultsDropdown.innerHTML = `
            <div class="search-results-header">🔎 Найдено ${results.length} книг</div>
            ${results.map(book => `
                <div class="search-result-item" data-book-id="${book.id}">
                    <div class="search-result-title">📖 ${escapeHtml(book.title)}</div>
                    <div class="search-result-author">✍️ ${escapeHtml(book.author)}</div>
                    <div class="search-result-match">${book.matchType}</div>
                </div>
            `).join('')}
        `;

        // Добавляем обработчики клика на результаты
        resultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                openBook(parseInt(item.dataset.bookId));
                resultsDropdown.style.display = 'none';
                searchInput.value = '';
            });
        });
    }
}

// ============================================================
//  ЗАГРУЗКА И ОТОБРАЖЕНИЕ КНИГ
// ============================================================

/**
 * Загружает все книги: сначала пытается из кэша, затем из сети.
 */
async function loadAllBooks() {
    if (isLoading) return;
    isLoading = true;

    console.log('📚 Загрузка книг...');
    if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'block';

    try {
        // Пробуем загрузить из кэша localStorage
        if (await loadFromCache()) {
            isLoading = false;
            if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
            return;
        }

        // Определяем список файлов для загрузки
        let bookFiles = [];

        try {
            const response = await fetch('books-list.json?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    bookFiles = data;
                    console.log('✅ Загружен books-list.json:', bookFiles);
                }
            }
        } catch(e) {
            console.warn('⚠️ Ошибка загрузки books-list.json:', e);
        }

        // Если список не загрузился, используем файлы по умолчанию
        if (!bookFiles.length) {
            bookFiles = DEFAULT_BOOK_FILES;
            console.log('📚 Используем список по умолчанию');
        }

        // Загружаем каждую книгу
        allBooks = [];
        for (let i = 0; i < bookFiles.length; i++) {
            try {
                const response = await fetch(bookFiles[i] + '?t=' + Date.now());
                if (response.ok) {
                    const data = await response.json();
                    if (data?.title && data.pages) {
                        data.id = i + 1;
                        allBooks.push(data);
                        console.log(`✅ Загружена: ${data.title}`);
                    }
                }
            } catch(e) {
                console.warn(`⚠️ Ошибка загрузки ${bookFiles[i]}:`, e);
            }
        }

        console.log(`📊 Всего загружено книг: ${allBooks.length}`);

        // Сохраняем в кэш и отображаем
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
            } catch(e) {
                console.warn('Ошибка сохранения кэша:', e);
            }
        }
    } catch(e) {
        console.error('❌ Критическая ошибка загрузки:', e);

        // Последняя попытка — кэш
        if (!await loadFromCache() && DOM.errorMessage) {
            DOM.errorMessage.style.display = 'block';
            DOM.errorMessage.innerHTML = `
                <h3>Ошибка загрузки</h3>
                <button id="retryButton" class="btn btn-read">Повторить</button>
            `;
            document.getElementById('retryButton')?.addEventListener('click', retryLoading);
        }
    } finally {
        isLoading = false;
        if (DOM.loadingIndicator) DOM.loadingIndicator.style.display = 'none';
    }
}

/**
 * Загружает книги из localStorage, если кэш актуален (менее 24 часов).
 * @returns {boolean} true, если загрузка из кэша успешна
 */
async function loadFromCache() {
    try {
        const cached = localStorage.getItem('cachedBooks');
        const timestamp = localStorage.getItem('cacheTimestamp');

        if (cached && timestamp && (Date.now() - parseInt(timestamp) < 86400000)) {
            allBooks = JSON.parse(cached);
            if (allBooks?.length > 0) {
                console.log(`⚡ Загружено из кэша: ${allBooks.length} книг`);
                renderBooks(allBooks);
                return true;
            }
        }
    } catch(e) {
        console.warn('Ошибка чтения кэша:', e);
    }
    return false;
}

/**
 * Отображает карточки книг в указанной сетке (или в основной).
 * @param {Array} books - Массив книг для отображения
 * @param {HTMLElement} targetGrid - Целевой контейнер (по умолчанию основная сетка)
 */
function renderBooks(books, targetGrid) {
    const grid = targetGrid || DOM.booksGrid;
    if (!grid) return;

    if (!books?.length) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;">Книги не найдены</div>';
        return;
    }

    // Используем DocumentFragment для оптимизации вставки в DOM
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

        // Навешиваем обработчики событий
        card.querySelector('.btn-read').addEventListener('click', () => openBook(book.id));

        card.querySelector('.btn-favorite').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(book.id, card.querySelector('.btn-favorite'));
        });

        card.querySelector('.btn-comments-card').addEventListener('click', (e) => {
            e.stopPropagation();
            openComments(book.id);
        });

        // Восстанавливаем состояние кнопки избранного
        if (isFavorite(book.id)) {
            card.querySelector('.btn-favorite').classList.add('active');
            card.querySelector('.btn-favorite').textContent = '★';
        }

        fragment.appendChild(card);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
}

// ============================================================
//  ЧИТАЛКА
// ============================================================

/**
 * Открывает книгу в читалке.
 * @param {number} bookId - ID книги
 */
window.openBook = function(bookId) {
    const book = allBooks.find(x => x.id === bookId);
    if (!book?.pages?.length) return;

    console.log(`📖 Открыта книга: ${book.title}`);

    // Обновляем URL
    history.pushState(
        { page: 'reader', bookId, navHistory: [...navigationHistory] },
        '',
        '/book/' + bookId
    );

    // Клонируем книгу, чтобы не мутировать оригинал
    currentBook = JSON.parse(JSON.stringify(book));
    currentPage = getReadingProgress(bookId);

    // Защита от битых данных: если сохраненная страница больше числа страниц
    if (currentPage > currentBook.pages.length) {
        currentPage = 1;
    }

    // Настройка шрифта под устройство
    const deviceType = getDeviceType();
    fontSize = deviceType === 'mobile' ? 14 : deviceType === 'tablet' ? 16 : 18;

    // Заполняем интерфейс читалки
    if (DOM.readerTitle) DOM.readerTitle.textContent = currentBook.title;
    if (DOM.readerContent) {
        DOM.readerContent.innerHTML = currentBook.pages[currentPage - 1];
        DOM.readerContent.style.fontSize = fontSize + 'px';
        DOM.readerContent.scrollTop = 0;
    }
    if (DOM.currentPage) DOM.currentPage.textContent = currentPage;
    if (DOM.totalPages) DOM.totalPages.textContent = currentBook.pages.length;

    // Показываем читалку и оверлей
    if (DOM.readerWindow) DOM.readerWindow.style.display = 'flex';
    if (DOM.overlay) DOM.overlay.style.display = 'block';

    applyDeviceLayout();
};

/**
 * Обновляет содержимое читалки (вызывается при перелистывании).
 */
function updateReaderContent() {
    if (!currentBook || !DOM.readerContent) return;

    DOM.readerContent.innerHTML = currentBook.pages[currentPage - 1];
    DOM.readerContent.style.fontSize = fontSize + 'px';
    DOM.readerContent.scrollTop = 0;

    if (DOM.currentPage) DOM.currentPage.textContent = currentPage;
}

/**
 * Закрывает читалку, сохраняя прогресс.
 * @param {boolean} updateHistory - Вызывать ли history.back()
 */
window.closeReader = function(updateHistory = true) {
    if (currentBook?.id) {
        saveReadingProgress(currentBook.id, currentPage);
    }

    if (isFullscreen) toggleFullscreen();

    if (DOM.readerWindow) DOM.readerWindow.style.display = 'none';
    if (DOM.overlay) DOM.overlay.style.display = 'none';

    if (updateHistory) history.back();
};

/**
 * Переключает полноэкранный режим читалки.
 */
window.toggleFullscreen = function() {
    if (!DOM.readerWindow) return;

    if (!isFullscreen) {
        // Входим в полноэкранный режим
        DOM.readerWindow.classList.add('fullscreen');
        if (DOM.overlay) DOM.overlay.style.display = 'none';
        isFullscreen = true;
    } else {
        // Выходим из полноэкранного режима
        DOM.readerWindow.classList.remove('fullscreen');
        if (DOM.overlay) DOM.overlay.style.display = 'block';
        isFullscreen = false;
        applyDeviceLayout();
    }
};

/**
 * Настройка всех обработчиков читалки (кнопки, клавиатура).
 */
function setupReader() {
    // Функции навигации по страницам
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

    // Кнопки пагинации (обычные и полноэкранные)
    DOM.prevPage?.addEventListener('click', prevPage);
    DOM.nextPage?.addEventListener('click', nextPage);
    DOM.fullscreenPrevBtn?.addEventListener('click', prevPage);
    DOM.fullscreenNextBtn?.addEventListener('click', nextPage);

    // Кнопки управления читалкой
    DOM.closeReader?.addEventListener('click', () => closeReader(true));
    DOM.overlay?.addEventListener('click', () => closeReader(true));
    DOM.exitFullscreenBtn?.addEventListener('click', toggleFullscreen);
    DOM.fullscreenBtn?.addEventListener('click', toggleFullscreen);

    // Кнопки изменения размера шрифта
    DOM.fontPlus?.addEventListener('click', () => {
        fontSize = Math.min(fontSize + 2, 30);
        if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
    });

    DOM.fontMinus?.addEventListener('click', () => {
        fontSize = Math.max(fontSize - 2, 14);
        if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
    });

    // Управление с клавиатуры
    document.addEventListener('keydown', (e) => {
        // Работает только когда читалка открыта
        if (!DOM.readerWindow || DOM.readerWindow.style.display !== 'flex') return;

        switch(e.key) {
            case 'Escape':
                if (isFullscreen) toggleFullscreen();
                else closeReader(true);
                break;
            case 'ArrowLeft':
            case 'PageUp':
                e.preventDefault();
                prevPage();
                break;
            case 'ArrowRight':
            case 'PageDown':
            case ' ':
                e.preventDefault();
                nextPage();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case '+':
            case '=':
                e.preventDefault();
                fontSize = Math.min(fontSize + 2, 30);
                if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
                break;
            case '-':
            case '_':
                e.preventDefault();
                fontSize = Math.max(fontSize - 2, 14);
                if (DOM.readerContent) DOM.readerContent.style.fontSize = fontSize + 'px';
                break;
        }
    });
}

// ============================================================
//  КОММЕНТАРИИ (Google Sheets API)
// ============================================================

/**
 * Получает комментарии для книги.
 */
async function getComments(bookId) {
    try {
        const response = await fetch(`${COMMENTS_API_URL}?bookId=${bookId}&t=${Date.now()}`);
        return JSON.parse(await response.text());
    } catch(e) {
        console.error('Ошибка загрузки комментариев:', e);
        return [];
    }
}

/**
 * Сохраняет новый комментарий.
 */
async function saveComment(bookId, name, text) {
    try {
        const params = new URLSearchParams({
            mode: 'add',
            bookId: String(bookId),
            name,
            text
        });
        const response = await fetch(`${COMMENTS_API_URL}?${params.toString()}`);
        return response.ok;
    } catch(e) {
        console.error('Ошибка сохранения комментария:', e);
        return false;
    }
}

/**
 * Открывает модальное окно комментариев.
 */
function openComments(bookId) {
    const modal = document.getElementById('commentsModal');
    if (!modal) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    loadComments(bookId);

    // Назначаем обработчики закрытия
    document.getElementById('commentsClose').onclick = closeComments;
    document.getElementById('commentsOverlay').onclick = closeComments;

    // Обработчик отправки формы
    document.getElementById('commentForm').onsubmit = (e) => {
        e.preventDefault();
        addComment(bookId);
    };
}

/**
 * Закрывает модальное окно комментариев.
 */
function closeComments() {
    const modal = document.getElementById('commentsModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Добавляет новый комментарий через API.
 */
async function addComment(bookId) {
    const nameInput = document.getElementById('commentName');
    const textInput = document.getElementById('commentText');
    const submitBtn = document.querySelector('#commentForm .btn-submit');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!name || !text) return;

    // Блокируем кнопку на время отправки
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳';

    const success = await saveComment(bookId, name, text);

    if (success) {
        nameInput.value = '';
        textInput.value = '';
        await loadComments(bookId);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = '📨 Отправить';
}

/**
 * Загружает и отображает список комментариев.
 */
async function loadComments(bookId) {
    const list = document.getElementById('commentsList');
    if (!list) return;

    list.innerHTML = '<div class="comment-empty">Загрузка...</div>';

    const comments = await getComments(bookId);

    if (!comments || comments.length === 0) {
        list.innerHTML = '<div class="comment-empty">💬 Пока нет комментариев</div>';
        return;
    }

    list.innerHTML = comments.map(comment => `
        <div class="comment-item">
            <div class="comment-author">
                ${escapeHtml(comment.name)}
                <span class="comment-date">${formatDate(comment.date)}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
        </div>
    `).join('');

    console.log(`📝 Загружено ${comments.length} комментариев для книги ${bookId}`);
}

// ============================================================
//  ОБРАТНАЯ СВЯЗЬ (FEEDBACK)
// ============================================================

function openFeedback() {
    const modal = document.getElementById('feedbackModal');
    if (!modal) return;

    // Обновляем URL
    history.pushState(
        { page: currentView, feedbackOpen: true },
        '',
        '/feedback'
    );

    // Создаем форму обратной связи
    document.getElementById('feedbackForm').innerHTML = `
        <div class="feedback-field">
            <label>Имя</label>
            <input id="feedbackName" placeholder="Необязательно">
        </div>
        <div class="feedback-field">
            <label>Тема</label>
            <select id="feedbackTopic">
                <option value="bug">🐛 Ошибка</option>
                <option value="feature">💡 Предложение</option>
                <option value="other">💬 Другое</option>
            </select>
        </div>
        <div class="feedback-field">
            <label>Сообщение</label>
            <textarea id="feedbackMessage" rows="5" required></textarea>
        </div>
        <button type="submit" class="btn-submit">📨 Отправить</button>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Обработчики закрытия
    document.getElementById('feedbackClose').onclick = () => closeFeedback(true);
    document.getElementById('feedbackOverlay').onclick = () => closeFeedback(true);

    // Обработчик отправки
    document.getElementById('feedbackForm').onsubmit = submitFeedback;
}

function closeFeedback(updateHistory) {
    const modal = document.getElementById('feedbackModal');
    if (!modal) return;

    modal.classList.remove('active');
    document.body.style.overflow = '';

    if (updateHistory && history.state?.feedbackOpen) {
        history.back();
    }
}

/**
 * Отправляет сообщение обратной связи через почтовый клиент пользователя.
 */
function submitFeedback(e) {
    e.preventDefault();

    const name = document.getElementById('feedbackName').value || 'Аноним';
    const topic = document.getElementById('feedbackTopic').value;
    const message = document.getElementById('feedbackMessage').value;

    const topicLabels = {
        bug: 'Ошибка',
        feature: 'Предложение',
        other: 'Другое'
    };

    const subject = `[Библиотека] ${topicLabels[topic]} от ${name}`;
    const body = `Имя: ${name}\nТема: ${topicLabels[topic]}\n\n${message}`;

    // Показываем сообщение об успехе
    document.getElementById('feedbackForm').innerHTML = `
        <div class="feedback-success">
            <div class="success-icon">✅</div>
            <h3>Спасибо!</h3>
            <p>Сообщение отправлено.</p>
            <button class="btn-submit" onclick="closeFeedback(true)" style="margin-top:15px">Закрыть</button>
        </div>
    `;

    // Открываем почтовый клиент
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        // На мобильных — mailto:
        location.href = `mailto:readworldfeedback@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
        // На десктопе — Gmail
        open(`https://mail.google.com/mail/?view=cm&fs=1&to=readworldfeedback@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    }
}

// ============================================================
//  СТРАНИЦЫ КАТЕГОРИЙ (ЖАНРЫ, АВТОРЫ, ИЗБРАННОЕ)
// ============================================================

function setupCategoryPages() {
    document.getElementById('backFromGenres')?.addEventListener('click', goBack);
    document.getElementById('backFromAuthors')?.addEventListener('click', goBack);
    document.getElementById('backFromFavorites')?.addEventListener('click', goBack);
}

/**
 * Показывает страницу со списком жанров.
 */
function showGenresPage() {
    if (!allBooks.length) return;

    // Группируем книги по жанрам
    const genresMap = new Map();
    allBooks.forEach(book => {
        const genre = book.genre || 'Без жанра';
        if (!genresMap.has(genre)) genresMap.set(genre, []);
        genresMap.get(genre).push(book);
    });

    // Создаем кнопки жанров
    const fragment = document.createDocumentFragment();
    genresMap.forEach((books, genre) => {
        const button = document.createElement('button');
        button.className = 'category-item';
        button.innerHTML = `
            <span>${escapeHtml(genre)}</span>
            <span class="count">${books.length} кн.</span>
        `;
        button.addEventListener('click', () => {
            // Фильтруем и показываем книги этого жанра
            renderBooks(allBooks.filter(b => (b.genre || 'Без жанра') === genre));
            showPage('main');
            scrollTo(0, 0);
        });
        fragment.appendChild(button);
    });

    DOM.genresList.innerHTML = '';
    DOM.genresList.appendChild(fragment);
    showPage('genres');
}

/**
 * Показывает страницу со списком авторов (отсортированы по алфавиту).
 */
function showAuthorsPage() {
    if (!allBooks.length) return;

    // Группируем книги по авторам
    const authorsMap = new Map();
    allBooks.forEach(book => {
        const author = book.author || 'Неизвестен';
        if (!authorsMap.has(author)) authorsMap.set(author, []);
        authorsMap.get(author).push(book);
    });

    // Сортируем по алфавиту
    const sortedAuthors = [...authorsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // Создаем кнопки авторов
    const fragment = document.createDocumentFragment();
    sortedAuthors.forEach(([author, books]) => {
        const button = document.createElement('button');
        button.className = 'category-item';
        button.innerHTML = `
            <span>${escapeHtml(author)}</span>
            <span class="count">${books.length} кн.</span>
        `;
        button.addEventListener('click', () => {
            renderBooks(allBooks.filter(b => (b.author || 'Неизвестен') === author));
            showPage('main');
            scrollTo(0, 0);
        });
        fragment.appendChild(button);
    });

    DOM.authorsList.innerHTML = '';
    DOM.authorsList.appendChild(fragment);
    showPage('authors');
}

/**
 * Показывает страницу с избранными книгами.
 */
function showFavorites() {
    const favorites = getFavorites();
    const grid = document.getElementById('favoritesBooksGrid');
    if (!grid) return;

    if (!favorites.length) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;">⭐ Пока нет избранных книг</div>';
    } else {
        renderBooks(allBooks.filter(b => favorites.includes(b.id)), grid);
    }

    showPage('favorites');
}

// ============================================================
//  БОКОВОЕ МЕНЮ
// ============================================================

function setupSideMenu() {
    const burgerBtn = document.getElementById('burgerBtn');
    const menu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');

    if (!burgerBtn || !menu) return;

    /**
     * Открывает боковое меню.
     */
    function open() {
        menu.classList.add('active');
        menu.style.right = '0';
        overlay.classList.add('active');
        overlay.style.display = 'block';
        overlay.style.opacity = '1';
        menuActive = true;
        document.body.style.overflow = 'hidden';

        history.pushState(
            { page: currentView, menuOpen: true },
            '',
            '/menu'
        );
    }

    /**
     * Закрывает боковое меню.
     * @param {boolean} useHistory - Использовать history.back()
     */
    function close(useHistory) {
        menu.classList.remove('active');
        menu.style.right = '-320px';
        overlay.classList.remove('active');
        overlay.style.opacity = '0';
        menuActive = false;
        document.body.style.overflow = '';

        setTimeout(() => {
            if (!menuActive) overlay.style.display = 'none';
        }, 300);

        if (useHistory && history.state?.menuOpen) {
            history.back();
        }
    }

    // Обработчики открытия/закрытия
    burgerBtn.addEventListener('click', open);
    document.getElementById('sideMenuClose').addEventListener('click', () => close(true));
    overlay.addEventListener('click', () => close(true));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuActive) close(true);
    });

    // Свайп для открытия меню с края экрана
    let startX = 0;
    document.addEventListener('touchstart', (e) => {
        if (!menuActive) startX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (menuActive) return;
        if (startX > innerWidth - 40 && startX - e.changedTouches[0].clientX > 50) {
            open();
        }
    });

    // Свайп для закрытия меню (перетаскивание вправо)
    let menuStartX = 0;
    let menuCurrentX = 0;
    let swiping = false;

    menu.addEventListener('touchstart', (e) => {
        if (!menuActive) return;
        menuStartX = e.touches[0].clientX;
        menuCurrentX = menuStartX;
        swiping = true;
    }, { passive: true });

    menu.addEventListener('touchmove', (e) => {
        if (!swiping || !menuActive) return;
        menuCurrentX = e.touches[0].clientX;
        const delta = menuCurrentX - menuStartX;
        if (delta > 0) {
            menu.style.right = '-' + Math.min(delta, 300) + 'px';
            overlay.style.opacity = 1 - Math.min(delta / 300, 1);
        }
    }, { passive: true });

    menu.addEventListener('touchend', () => {
        if (!swiping || !menuActive) {
            swiping = false;
            return;
        }
        swiping = false;

        if (menuCurrentX - menuStartX > 80) {
            close(true);
        } else {
            menu.style.right = '0';
            overlay.style.opacity = '1';
        }
    });

    // Пункты меню — переключение страниц
    document.getElementById('menuGenres').addEventListener('click', () => {
        close(false);
        setTimeout(showGenresPage, 300);
    });

    document.getElementById('menuAuthors').addEventListener('click', () => {
        close(false);
        setTimeout(showAuthorsPage, 300);
    });

    document.getElementById('menuFavorites').addEventListener('click', () => {
        close(false);
        setTimeout(showFavorites, 300);
    });

    document.getElementById('menuFeedback').addEventListener('click', () => {
        close(false);
        setTimeout(openFeedback, 300);
    });

    document.getElementById('menuAll').addEventListener('click', () => {
        close(false);
        setTimeout(() => {
            renderBooks(allBooks);
            showPage('main');
            scrollTo(0, 0);
        }, 300);
    });
}

// ============================================================
//  ТЕМА ОФОРМЛЕНИЯ
// ============================================================

function setupTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    document.body.classList.add(savedTheme + '-theme');
    updateThemeIcon(savedTheme);

    document.getElementById('themeToggle').addEventListener('click', () => {
        if (document.body.classList.contains('light-theme')) {
            document.body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('selectedTheme', 'dark');
            updateThemeIcon('dark');
        } else {
            document.body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('selectedTheme', 'light');
            updateThemeIcon('light');
        }
    });
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.querySelector('.theme-icon-light').style.display = theme === 'dark' ? 'none' : 'inline';
    btn.querySelector('.theme-icon-dark').style.display = theme === 'dark' ? 'inline' : 'none';
}

// ============================================================
//  SERVICE WORKER И ОФЛАЙН
// ============================================================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('🔧 Service Worker зарегистрирован');

                // Периодическая проверка обновлений (раз в час)
                setInterval(() => registration.update(), 3600000);

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🔄 Обнаружено обновление, перезагрузка...');
                            localStorage.removeItem('cachedBooks');
                            localStorage.removeItem('cacheTimestamp');
                            window.location.reload();
                        }
                    });
                });
            })
            .catch(err => console.error('Ошибка регистрации Service Worker:', err));
    }
}

/**
 * Обновляет индикатор состояния подключения в правом нижнем углу.
 */
function updateConnectionStatus() {
    let indicator = document.getElementById('connection-status');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connection-status';
        indicator.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 16px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 999;
            background: rgba(0,0,0,0.7);
            color: white;
            pointer-events: none;
        `;
        document.body.appendChild(indicator);
    }

    indicator.textContent = navigator.onLine ? '● Онлайн' : '○ Офлайн';
    indicator.style.background = navigator.onLine
        ? 'rgba(46,125,50,0.9)'
        : 'rgba(128,128,128,0.9)';
}

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Кэширует ссылки на все используемые DOM-элементы при инициализации.
 */
function cacheDomElements() {
    const ids = [
        'booksGrid', 'loadingIndicator', 'errorMessage', 'readerWindow', 'overlay',
        'readerTitle', 'readerContent', 'currentPage', 'totalPages', 'currentYear',
        'themeToggle', 'closeReader', 'prevPage', 'nextPage',
        'fontPlus', 'fontMinus', 'fullscreenBtn', 'exitFullscreenBtn',
        'fullscreenPrevBtn', 'fullscreenNextBtn',
        'mainPage', 'genresPage', 'authorsPage', 'favoritesPage',
        'favoritesBooksGrid', 'genresList', 'authorsList',
        'menuFavorites', 'menuFeedback', 'backFromFavorites'
    ];

    ids.forEach(id => {
        DOM[id] = document.getElementById(id);
    });
}

/**
 * Повторная попытка загрузки книг при ошибке.
 */
window.retryLoading = function() {
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';

    // Очищаем кэш и загружаем заново
    localStorage.removeItem('cachedBooks');
    localStorage.removeItem('cacheTimestamp');
    allBooks = [];
    loadAllBooks();
};

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Инициализация приложения...');

    // 1. Кэшируем DOM-элементы
    cacheDomElements();

    // 2. Устанавливаем год в футере
    if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();

    // 3. Показываем главную страницу (без записи в историю)
    showPage('main', false);

    // 4. Инициализируем тему
    setupTheme();

    // 5. Инициализируем читалку
    setupReader();

    // 6. Инициализируем боковое меню
    setupSideMenu();

    // 7. Инициализируем страницы категорий
    setupCategoryPages();

    // 8. Обновляем индикатор подключения
    updateConnectionStatus();

    // 9. Добавляем CSS-переходы для читалки
    const style = document.createElement('style');
    style.textContent = '.reader-content { transition: padding 0.2s ease, line-height 0.2s ease; }';
    document.head.appendChild(style);

    // 10. Загружаем книги
    await loadAllBooks();

    // 11. Добавляем поиск
    addSearchBar();

    // 12. Регистрируем Service Worker
    registerServiceWorker();

    console.log('✅ Приложение готово');

    // 13. Обработчик кнопки "назад" в браузере
    window.addEventListener('popstate', (e) => {
        // Закрываем модальные окна, если они открыты
        if (document.getElementById('feedbackModal')?.classList.contains('active')) {
            closeFeedback(false);
            return;
        }
        if (document.getElementById('commentsModal')?.classList.contains('active')) {
            closeComments();
            return;
        }

        // Закрываем боковое меню
        if (menuActive) {
            const sideMenu = document.getElementById('sideMenu');
            const menuOverlay = document.getElementById('menuOverlay');

            sideMenu.classList.remove('active');
            sideMenu.style.right = '-320px';
            menuOverlay.classList.remove('active');
            menuOverlay.style.opacity = '0';
            menuActive = false;
            document.body.style.overflow = '';

            setTimeout(() => {
                if (!menuActive) menuOverlay.style.display = 'none';
            }, 300);

            if (currentView === 'main') {
                history.replaceState(
                    { page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false },
                    '',
                    '/'
                );
            }
            return;
        }

        // Закрываем читалку
        if (DOM.readerWindow?.style.display === 'flex') {
            closeReader(false);
            return;
        }

        // Восстанавливаем состояние из истории
        if (e.state?.page) {
            showPage(e.state.page, false);
            if (e.state.navHistory) navigationHistory = e.state.navHistory;

            if (e.state.page === 'main') {
                history.replaceState(
                    { page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false },
                    '',
                    '/'
                );
            }
            return;
        }

        // Навигация по внутренней истории
        if (navigationHistory.length > 0) {
            goBack();
        } else {
            showPage('main', false);
            history.replaceState(
                { page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false },
                '',
                '/'
            );
        }
    });

    // Устанавливаем начальное состояние истории
    history.replaceState(
        { page: 'main', navHistory: [], menuOpen: false, feedbackOpen: false },
        '',
        '/'
    );
});

// 14. Обработчики онлайна/офлайна
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// 15. Оптимизированный обработчик ресайза (debounce)
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        cachedDeviceType = null;

        if (currentBook && DOM.readerWindow?.style.display === 'flex') {
            applyDeviceLayout();

            // Проверяем, не вышли ли за границы страниц
            if (currentPage > currentBook.pages.length) {
                currentPage = currentBook.pages.length;
                updateReaderContent();
                saveReadingProgress(currentBook.id, currentPage);
            }
        }
    }, 150);
});

// Экспортируем для глобального доступа
window.loadAllBooks = loadAllBooks;
