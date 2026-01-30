<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');

$data_file = 'reviews.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Получить отзывы
    if (file_exists($data_file)) {
        echo file_get_contents($data_file);
    } else {
        echo json_encode([]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Добавить отзыв
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input) {
        $reviews = [];
        if (file_exists($data_file)) {
            $reviews = json_decode(file_get_contents($data_file), true);
        }
        
        $new_review = [
            'id' => time() . rand(1000, 9999),
            'name' => htmlspecialchars($input['name']),
            'rating' => intval($input['rating']),
            'text' => htmlspecialchars($input['text']),
            'date' => date('c')
        ];
        
        array_unshift($reviews, $new_review);
        file_put_contents($data_file, json_encode($reviews, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        echo json_encode(['success' => true]);
    }
}
?>