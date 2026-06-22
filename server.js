const express = require('express');
const path = require('path');
const app = express();

// Раздаём файлы из корня проекта
app.use(express.static(path.join(__dirname)));

// Для SPA — отдаём index.html для всех не-файловых запросов
app.get('*', (req, res, next) => {
    // Пропускаем запросы к существующим файлам
    if (req.path.includes('.')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server: ${PORT}`));
