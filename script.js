// Простейший рабочий скрипт
console.log('Скрипт запущен');

// Год в футере
var yearSpan = document.getElementById('currentYear');
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// Переключение тем
function switchTheme(themeName) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(themeName + '-theme');
    localStorage.setItem('selectedTheme', themeName);
}

function loadSavedTheme() {
    var savedTheme = localStorage.getItem('selectedTheme') || 'light';
    switchTheme(savedTheme);
    var btn = document.getElementById('theme-' + savedTheme);
    if (btn) btn.classList.add('active');
}

var themeLight = document.getElementById('theme-light');
var themeDark = document.getElementById('theme-dark');

if (themeLight) {
    themeLight.addEventListener('click', function() {
        switchTheme('light');
        themeLight.classList.add('active');
        themeDark.classList.remove('active');
    });
}

if (themeDark) {
    themeDark.addEventListener('click', function() {
        switchTheme('dark');
        themeDark.classList.add('active');
        themeLight.classList.remove('active');
    });
}

loadSavedTheme();

// Простая заглушка для книг
var booksGrid = document.getElementById('booksGrid');
if (booksGrid) {
    booksGrid.innerHTML = '<div style="text-align:center; padding:40px;">Загрузка книг...</div>';
}

// Функция для загрузки книг (упрощенная)
async function loadBooks() {
    try {
        var response = await fetch('books-list.json');
        var bookFiles = await response.json();
        
        var allBooks = [];
        
        for (var i = 0; i < bookFiles.length; i++) {
            try {
                var bookResponse = await fetch(bookFiles[i]);
                var bookData = await bookResponse.json();
                bookData.id = i + 1;
                allBooks.push(bookData);
            } catch(e) {
                console.log('Ошибка загрузки:', bookFiles[i]);
            }
        }
        
        if (booksGrid) {
            booksGrid.innerHTML = '';
            
            for (var i = 0; i < allBooks.length; i++) {
                var book = allBooks[i];
                var card = document.createElement('div');
                card.className = 'book-card';
                card.innerHTML = '<div class="book-cover">' + (book.cover || book.title) + '</div>' +
                    '<div class="book-title">' + book.title + '</div>' +
                    '<div class="book-meta">' +
                        '<p><strong>Автор:</strong> ' + book.author + '</p>' +
                        '<p><strong>Год:</strong> ' + (book.year || 'Не указан') + '</p>' +
                        '<p><strong>Страниц:</strong> ' + (book.pages ? book.pages.length : 0) + '</p>' +
                    '</div>' +
                    '<div class="book-buttons">' +
                        '<button class="btn btn-read" data-id="' + book.id + '">📖 Читать</button>' +
                    '</div>';
                booksGrid.appendChild(card);
            }
        }
        
    } catch(e) {
        console.log('Ошибка:', e);
        if (booksGrid) {
            booksGrid.innerHTML = '<div style="text-align:center; padding:40px; color:red;">Ошибка загрузки книг</div>';
        }
    }
}

loadBooks();

// Простая читалка
window.openBook = function(bookId) {
    alert('Функция чтения в разработке');
};