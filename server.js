const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Логируем все запросы для отладки
app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

// Раздаём файлы
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
    }
}));

// Только для несуществующих файлов — index.html
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, req.path);
    if (!fs.existsSync(filePath) && !req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.listen(process.env.PORT || 3000);
