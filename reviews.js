// api/reviews.js
import fs from 'fs';
import path from 'path';

// Файл для хранения отзывов
const reviewsFilePath = path.join(process.cwd(), 'data', 'reviews.json');

export default async function handler(req, res) {
  // Настраиваем CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обрабатываем OPTIONS запрос для CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Создаем папку data, если её нет
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Инициализируем файл, если его нет
  if (!fs.existsSync(reviewsFilePath)) {
    fs.writeFileSync(reviewsFilePath, JSON.stringify([]));
  }

  try {
    if (req.method === 'GET') {
      // Читаем отзывы из файла
      const reviewsData = fs.readFileSync(reviewsFilePath, 'utf8');
      const reviews = JSON.parse(reviewsData);
      
      res.status(200).json(reviews);
      
    } else if (req.method === 'POST') {
      // Добавляем новый отзыв
      const { name, rating, text } = req.body;
      
      // Валидация
      if (!name || !rating || !text) {
        return res.status(400).json({ 
          error: 'Необходимо заполнить все поля' 
        });
      }
      
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ 
          error: 'Оценка должна быть от 1 до 5' 
        });
      }
      
      // Читаем существующие отзывы
      const reviewsData = fs.readFileSync(reviewsFilePath, 'utf8');
      const reviews = JSON.parse(reviewsData);
      
      // Создаем новый отзыв
      const newReview = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        name: name.trim().substring(0, 50),
        rating: parseInt(rating),
        text: text.trim().substring(0, 1000),
        date: new Date().toISOString()
      };
      
      // Добавляем в начало массива
      reviews.unshift(newReview);
      
      // Сохраняем в файл
      fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
      
      res.status(200).json({ 
        success: true, 
        review: newReview,
        message: 'Отзыв успешно добавлен'
      });
      
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
      res.status(405).json({ error: `Метод ${req.method} не разрешен` });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
}