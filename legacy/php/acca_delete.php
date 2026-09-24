<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit;

$base_dir = "uploads/";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['file_url']) && !empty($_POST['file_url'])) {
        // Ekstrak path relatif dari URL
        $url_path = parse_url($_POST['file_url'], PHP_URL_PATH);
        $file_relative_path = explode('/uploads/', $url_path);

        if (isset($file_relative_path[1])) {
            $target_file = $base_dir . urldecode($file_relative_path[1]);

            if (file_exists($target_file) && is_file($target_file)) {
                if (unlink($target_file)) {
                    echo json_encode(["ok" => true, "message" => "File berhasil dihapus dari hosting"]);
                    exit;
                } else {
                    echo json_encode(["ok" => false, "error" => "Gagal menghapus file fisik di server"]);
                    exit;
                }
            } else {
                echo json_encode(["ok" => false, "error" => "File tidak ditemukan di path: " . $target_file]);
                exit;
            }
        } else {
            echo json_encode(["ok" => false, "error" => "URL tidak mengandung path uploads/"]);
            exit;
        }
    } else {
        echo json_encode(["ok" => false, "error" => "URL file tidak dikirim"]);
        exit;
    }
} else {
    echo json_encode(["ok" => false, "error" => "Metode tidak diizinkan"]);
    exit;
}
?>