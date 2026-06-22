const express = require('express');
const path = require('path');
const app = express();

// Раздаём статические файлы
app.use(express.static(__dirname));

// Только для несуществующих файлов отдаём index.html (SPA)
app.get('*', (req, res) => {
    // Проверяем, существует ли файл
    const filePath = path.join(__dirname, req.path);
    const fs = require('fs');
    
    if (!fs.existsSync(filePath) && !req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else if (!fs.existsSync(filePath)) {
        res.status(404).send('Not Found');
    } else {
        res.sendFile(filePath);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server: ${PORT}`));
