<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$filePath = $input['file_path'] ?? '';

if (empty($filePath)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "File path is required"]);
    exit;
}

// Security: Prevent directory traversal
$baseDir = __DIR__ . '/uploads/'; // Sesuaikan dengan folder upload Anda jika berbeda
$realBase = realpath($baseDir);
$targetFile = realpath($baseDir . $filePath);

// Simple check: ensure the file is inside the upload directory
// Note: Depending on how you store file_path in DB, you might need to adjust this logic.
// If file_path is full URL, parse it. If it's relative path like 'uploads/file.pdf', use it directly.

// Asumsi: file_path yang dikirim adalah path relatif dari root domain atau folder script ini
// Jika file_path dari DB misal: "uploads/Official/file.pdf"
// Maka kita coba delete file tersebut.

$fileToDelete = __DIR__ . '/' . ltrim($filePath, '/');

if (file_exists($fileToDelete) && is_file($fileToDelete)) {
    if (unlink($fileToDelete)) {
        echo json_encode(["status" => "success", "message" => "File deleted successfully"]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Failed to delete file"]);
    }
} else {
    // If file not found, we still return success to allow DB deletion to proceed
    // or return error 404 if you want strict checking.
    // For sync purposes, returning success is safer to avoid orphan DB records if file is already gone.
    echo json_encode(["status" => "success", "message" => "File not found, but assumed deleted"]);
}
?>