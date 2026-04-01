// ========== 📚 ЗАГРУЗКА КНИГ (ИСПРАВЛЕННАЯ) ==========

// Загрузка всех книг
async function loadAllBooks() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const booksGrid = document.getElementById('booksGrid');
    
    if (!booksGrid) {
        console.error('Элемент booksGrid не найден');
        return;
    }
    
    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (errorMessage) errorMessage.style.display = 'none';
        booksGrid.innerHTML = '<div class="loading">📚 Загрузка книг...</div>';
        
        allBooks = [];
        let loadedCount = 0;
        
        // Загружаем книги последовательно
        for (const config of BOOKS_CONFIG) {
            try {
                console.log(`Загрузка ${config.filename}...`);
                const response = await fetch(config.filename);
                
                if (!response.ok) {
                    console.warn(`❌ ${config.filename} - не найден (${response.status})`);
                    continue;
                }
                
                const text = await response.text();
                
                if (!text || !text.trim()) {
                    console.warn(`❌ ${config.filename} - пустой файл`);
                    continue;
                }
                
                let bookData;
                try {
                    bookData = JSON.parse(text);
                } catch (e) {
                    console.warn(`❌ ${config.filename} - ошибка парсинга JSON`);
                    continue;
                }
                
                // Проверяем обязательные поля
                if (!bookData.title) {
                    console.warn(`❌ ${config.filename} - отсутствует поле title`);
                    continue;
                }
                if (!bookData.author) {
                    console.warn(`❌ ${config.filename} - отсутствует поле author`);
                    continue;
                }
                if (!bookData.pages || !Array.isArray(bookData.pages) || bookData.pages.length === 0) {
                    console.warn(`❌ ${config.filename} - отсутствует pages или он пуст`);
                    continue;
                }
                
                bookData.id = config.id;
                allBooks.push(bookData);
                loadedCount++;
                console.log(`✅ Загружена: ${bookData.title} (${bookData.pages.length} стр.)`);
                
            } catch (error) {
                console.warn(`❌ Ошибка загрузки ${config.filename}:`, error.message);
            }
        }
        
        console.log(`📊 Итого загружено: ${loadedCount} из ${BOOKS_CONFIG.length} книг`);
        
        // Если книги загружены, отображаем их
        if (allBooks.length > 0) {
            renderBooks(allBooks);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            // Сохраняем в localStorage
            try {
                localStorage.setItem('cachedBooks', JSON.stringify(allBooks));
                localStorage.setItem('cacheTimestamp', Date.now().toString());
                console.log('💾 Книги сохранены в кэш');
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
                    if (cacheAge < 3600000) { // 1 час
                        allBooks = JSON.parse(cachedBooks);
                        renderBooks(allBooks);
                        if (loadingIndicator) loadingIndicator.style.display = 'none';
                        console.log('💿 Используем кэшированные книги');
                        showToast('📀 Книги загружены из кэша');
                        return;
                    }
                }
            } catch (e) {
                console.warn('Ошибка при чтении кэша:', e);
            }
            
            throw new Error('Не удалось загрузить ни одной книги');
        }
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (errorMessage) {
            errorMessage.style.display = 'block';
            errorMessage.innerHTML = `
                <h3>📖 Ошибка загрузки книг</h3>
                <p>Не удалось загрузить книги. Проверьте:</p>
                <ul style="text-align: left; display: inline-block; margin: 15px 0;">
                    <li>🔹 Файлы <strong>book1.json...book7.json</strong> есть в корне сайта</li>
                    <li>🔹 Формат JSON правильный (можно проверить на <strong>jsonlint.com</strong>)</li>
                    <li>🔹 Есть подключение к интернету</li>
                </ul>
                <p style="margin-top: 15px;">
                    <button onclick="retryLoading()" class="btn btn-read" style="margin: 0 auto;">🔄 Повторить</button>
                </p>
                <p style="margin-top: 10px; font-size: 0.85em;">
                    <a href="javascript:void(0)" onclick="showBookList()">📋 Показать список файлов</a>
                </p>
            `;
        }
    }
}
