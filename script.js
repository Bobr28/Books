// Глобальные переменные
let currentBook = null;
let currentPage = 1;
let fontSize = 18;
let isFullscreen = false;
let allBooks = [];

// Конфигурация - пути к файлам книг (прямо в корне)
const BOOKS_CONFIG = [
    { id: 1, filename: 'book1.json' },
    { id: 2, filename: 'book2.json' },
    { id: 3, filename: 'book3.json' },
    { id: 4, filename: 'book4.json' },
    { id: 5, filename: 'book5.json' },
    { id: 6, filename: 'book6.json' }
];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Устанавливаем текущий год в футере
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Назначаем обработчики для переключения тем
    setupThemeSwitcher();
    
    // Восстанавливаем сохраненную тему
    loadSavedTheme();
    
    // Загружаем книги
    loadAllBooks();
    
    // Настраиваем читалку
    setupReader();
});

// Настройка переключателя тем
function setupThemeSwitcher() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    
    themeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const theme = this.id.replace('theme-', '');
            switchTheme(theme);
            
            // Обновляем активную кнопку
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

// Загрузка всех книг
async function loadAllBooks() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const booksGrid = document.getElementById('booksGrid');
    
    try {
        loadingIndicator.style.display = 'block';
        errorMessage.style.display = 'none';
        booksGrid.innerHTML = '';
        
        // Загружаем все книги последовательно
        allBooks = [];
        
        for (const config of BOOKS_CONFIG) {
            try {
                const bookData = await loadBookFile(config.filename);
                if (bookData) {
                    bookData.id = config.id; // Устанавливаем ID из конфигурации
                    allBooks.push(bookData);
                    console.log(`Загружена книга: ${bookData.title}`);
                }
            } catch (error) {
                console.warn(`Не удалось загрузить книгу ${config.filename}:`, error);
            }
        }
        
        // Если книги загружены, отображаем их
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            loadingIndicator.style.display = 'none';
            
            // Сохраняем книги в localStorage для кэширования
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
            } catch (e) {
                console.warn('Не удалось кэшировать книги:', e);
            }
        } else {
            // Пробуем загрузить из кэша
            try {
                const cachedBooks = localStorage.getItem('cachedBooks');
                const cacheTimestamp = localStorage.getItem('cacheTimestamp');
                
                if (cachedBooks && cacheTimestamp) {
                    const cacheAge = Date.now() - parseInt(cacheTimestamp);
                    // Используем кэш, если ему меньше 1 часа
                    if (cacheAge < 3600000) {
                        allBooks = JSON.parse(cachedBooks);
                        renderBooks(allBooks);
                        loadingIndicator.style.display = 'none';
                        console.log('Используем кэшированные книги');
                        return;
                    }
                }
            } catch (e) {
                console.warn('Ошибка при чтении кэша:', e);
            }
            
            throw new Error('Не удалось загрузить ни одной книги');
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке книг:', error);
        loadingIndicator.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.innerHTML = `
            <h3>Ошибка загрузки</h3>
            <p>Не удалось загрузить книги. Возможные причины:</p>
            <ul style="text-align: left; display: inline-block;">
                <li>Файлы книг не найдены на сервере</li>
                <li>Проблемы с интернет-соединением</li>
                <li>Некорректный формат файлов</li>
            </ul>
            <p style="margin-top: 15px;">
                <button onclick="retryLoading()" class="btn btn-read" style="margin: 0 auto;">Повторить попытку</button>
            </p>
            <p style="margin-top: 10px; font-size: 0.9em;">
                <a href="javascript:void(0)" onclick="showBookList()">Показать список файлов книг</a>
            </p>
        `;
    }
}

// Показать список файлов книг
function showBookList() {
    const fileList = BOOKS_CONFIG.map(config => config.filename).join('\n');
    alert(`Файлы книг, которые пытались загрузить:\n\n${fileList}\n\nУбедитесь, что эти файлы находятся в корне проекта.`);
}

// Повторная попытка загрузки
function retryLoading() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'none';
    loadAllBooks();
}

// Загрузка отдельного файла книги
async function loadBookFile(filename) {
    try {
        const response = await fetch(filename);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Проверяем, что файл не пустой
        if (!text.trim()) {
            throw new Error('Файл пустой');
        }
        
        // Пробуем распарсить JSON
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
        booksGrid.innerHTML = '<p class="no-books">Книги не найдены</p>';
        return;
    }
    
    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.innerHTML = `
            <div class="book-cover">${book.cover || book.title}</div>
            <div class="book-title">${book.title}</div>
            <div class="book-meta">
                <p><strong>Автор:</strong> ${book.author}</p>
                <p><strong>Год:</strong> ${book.year || 'Не указан'}</p>
                <p><strong>Страниц:</strong> ${book.pages ? book.pages.length : 0}</p>
            </div>
            <div class="book-buttons">
                <button class="btn btn-read" data-id="${book.id}">Читать</button>
                <button class="btn btn-details" data-id="${book.id}">Подробнее</button>
            </div>
        `;
        
        booksGrid.appendChild(bookCard);
    });
    
    // Назначаем обработчики для кнопок
    document.querySelectorAll('.btn-read').forEach(button => {
        button.addEventListener('click', function() {
            const bookId = parseInt(this.getAttribute('data-id'));
            openBook(bookId);
        });
    });
    
    document.querySelectorAll('.btn-details').forEach(button => {
        button.addEventListener('click', function() {
            const bookId = parseInt(this.getAttribute('data-id'));
            showBookDetails(bookId);
        });
    });
}

// Функция открытия книги
function openBook(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book || !book.pages || book.pages.length === 0) {
        alert('Ошибка: книга не найдена или повреждена');
        return;
    }
    
    currentBook = book;
    currentPage = 1;
    fontSize = 18;
    
    // Показываем читалку
    document.getElementById('readerTitle').textContent = book.title;
    document.getElementById('readerContent').innerHTML = book.pages[0];
    document.getElementById('readerContent').style.fontSize = fontSize + 'px';
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = book.pages.length;
    
    document.getElementById('readerWindow').style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
    
    // Прокручиваем в начало
    document.getElementById('readerContent').scrollTop = 0;
}

// Функция показа подробностей о книге
function showBookDetails(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    
    const message = `${book.title}\n\nАвтор: ${book.author}\nГод: ${book.year || 'Не указан'}\nСтраниц: ${book.pages ? book.pages.length : 0}\n\nПервые строки:\n${book.pages && book.pages[0] ? book.pages[0].replace(/<[^>]*>/g, '').substring(0, 150) : ''}...`;
    alert(message);
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
    const readerContent = document.getElementById('readerContent');
    
    // Закрытие читалки
    closeBtn.addEventListener('click', closeReader);
    overlay.addEventListener('click', closeReader);
    exitFullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Навигация по страницам
    prevBtn.addEventListener('click', function() {
        if (currentBook && currentPage > 1) {
            currentPage--;
            updateReaderContent();
        }
    });
    
    nextBtn.addEventListener('click', function() {
        if (currentBook && currentPage < currentBook.pages.length) {
            currentPage++;
            updateReaderContent();
        }
    });
    
    // Навигация в полноэкранном режиме
    fullscreenPrevBtn.addEventListener('click', function() {
        if (currentBook && currentPage > 1) {
            currentPage--;
            updateReaderContent();
        }
    });
    
    fullscreenNextBtn.addEventListener('click', function() {
        if (currentBook && currentPage < currentBook.pages.length) {
            currentPage++;
            updateReaderContent();
        }
    });
    
    // Изменение размера шрифта
    fontPlus.addEventListener('click', function() {
        fontSize = Math.min(fontSize + 2, 30);
        readerContent.style.fontSize = fontSize + 'px';
        const scrollPos = readerContent.scrollTop;
        readerContent.scrollTop = scrollPos;
    });
    
    fontMinus.addEventListener('click', function() {
        fontSize = Math.max(fontSize - 2, 14);
        readerContent.style.fontSize = fontSize + 'px';
        const scrollPos = readerContent.scrollTop;
        readerContent.scrollTop = scrollPos;
    });
    
    // Полноэкранный режим
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Горячие клавиши
    document.addEventListener('keydown', function(e) {
        if (readerWindow.style.display === 'flex') {
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    toggleFullscreen();
                } else {
                    closeReader();
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                if (currentBook && currentPage > 1) {
                    currentPage--;
                    updateReaderContent();
                }
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                if (currentBook && currentPage < currentBook.pages.length) {
                    currentPage++;
                    updateReaderContent();
                }
            } else if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen();
            } else if (e.key === '+') {
                fontSize = Math.min(fontSize + 2, 30);
                readerContent.style.fontSize = fontSize + 'px';
            } else if (e.key === '-') {
                fontSize = Math.max(fontSize - 2, 14);
                readerContent.style.fontSize = fontSize + 'px';
            }
        }
    });
    
    // Предотвращаем закрытие при клике на саму читалку
    readerWindow.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

// Переключение полноэкранного режима
function toggleFullscreen() {
    const readerWindow = document.getElementById('readerWindow');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
    
    if (!isFullscreen) {
        // Входим в полноэкранный режим
        readerWindow.classList.add('fullscreen');
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = 'Обычный режим';
        exitFullscreenBtn.style.display = 'flex';
        document.getElementById('fullscreenPrevBtn').style.display = 'flex';
        document.getElementById('fullscreenNextBtn').style.display = 'flex';
        document.getElementById('overlay').style.display = 'none';
        isFullscreen = true;
        
        const readerContent = document.getElementById('readerContent');
        readerContent.style.paddingLeft = '50px';
        readerContent.style.paddingRight = '50px';
    } else {
        // Выходим из полноэкранного режима
        readerWindow.classList.remove('fullscreen');
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = 'Полноэкранный режим';
        exitFullscreenBtn.style.display = 'none';
        document.getElementById('fullscreenPrevBtn').style.display = 'none';
        document.getElementById('fullscreenNextBtn').style.display = 'none';
        document.getElementById('overlay').style.display = 'block';
        isFullscreen = false;
        
        const readerContent = document.getElementById('readerContent');
        readerContent.style.paddingLeft = '30px';
        readerContent.style.paddingRight = '30px';
    }
}

// Обновление контента в читалке
function updateReaderContent() {
    if (!currentBook) return;
    
    const readerContent = document.getElementById('readerContent');
    const currentPageEl = document.getElementById('currentPage');
    
    readerContent.innerHTML = currentBook.pages[currentPage - 1];
    readerContent.style.fontSize = fontSize + 'px';
    currentPageEl.textContent = currentPage;
    
    // Прокручиваем в начало страницы
    readerContent.scrollTop = 0;
}

// Закрытие читалки
function closeReader() {
    if (isFullscreen) {
        toggleFullscreen();
    }
    
    document.getElementById('readerWindow').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('exitFullscreenBtn').style.display = 'none';
    document.getElementById('fullscreenPrevBtn').style.display = 'none';
    document.getElementById('fullscreenNextBtn').style.display = 'none';
}

// Экспортируем функции для отладки
window.loadAllBooks = loadAllBooks;
window.openBook = openBook;
window.showBookList = showBookList;