<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit;

@ini_set('upload_max_filesize', '512M');
@ini_set('post_max_size', '512M');
@ini_set('memory_limit', '512M');
@set_time_limit(300);
@ini_set('max_execution_time', '300');
@ini_set('max_input_time', '300');

// 1. Pengaturan Direktori
$base_dir = "uploads/";

// --- LOGIKA PENGHAPUSAN (ACTION: DELETE) ---
if (isset($_POST['action']) && $_POST['action'] === 'delete') {
    if (isset($_POST['file_url']) && !empty($_POST['file_url'])) {
        // Ekstrak path relatif dari URL
        // Contoh URL: https://icgowa.sch.id/.../uploads/Informasi%20Akademik/file.pdf
        $url_path = parse_url($_POST['file_url'], PHP_URL_PATH);
        $file_relative_path = explode('/uploads/', $url_path);

        if (isset($file_relative_path[1])) {
            $target_file = $base_dir . urldecode($file_relative_path[1]);

            if (file_exists($target_file) && is_file($target_file)) {
                if (unlink($target_file)) {
                    echo json_encode(["ok" => true, "message" => "File berhasil dihapus dari hosting"]);
                    exit;
                }
            }
            echo json_encode(["ok" => false, "error" => "File tidak ditemukan atau gagal dihapus", "path" => $target_file]);
            exit;
        }
    }
    echo json_encode(["ok" => false, "error" => "URL file tidak valid"]);
    exit;
}

// --- LOGIKA UPLOAD (DEFAULT) ---
$folder = isset($_POST['folder']) ? $_POST['folder'] . "/" : "others/";
$target_dir = $base_dir . $folder;

// Buat folder jika belum ada
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0777, true);
}

// Logika Penghapusan File Lama (Update)
if (isset($_POST['old_file']) && !empty($_POST['old_file'])) {
    $url_path = parse_url($_POST['old_file'], PHP_URL_PATH);
    $file_relative_path = explode('/uploads/', $url_path);
    if (isset($file_relative_path[1])) {
        $old_path = $base_dir . urldecode($file_relative_path[1]);
        if (file_exists($old_path) && is_file($old_path)) {
            unlink($old_path);
        }
    }
}

if (isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $new_name = uniqid() . "_" . time() . "." . $ext;
    $target_file = $target_dir . $new_name;

    if (move_uploaded_file($file['tmp_name'], $target_file)) {
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
        $host = $_SERVER['HTTP_HOST'];
        $base_path = dirname($_SERVER['PHP_SELF']);
        $base_path = ($base_path === '/' || $base_path === '\\' || strpos($base_path, $host) !== false) ? '' : $base_path;
        
        $public_url = $protocol . "://" . $host . ($base_path ? $base_path . "/" : "/") . $target_file;

        echo json_encode([
            "ok" => true,
            "publicUrl" => $public_url,
            "message" => "Upload berhasil"
        ]);
    } else {
        echo json_encode(["ok" => false, "error" => "Gagal memindahkan file di server"]);
    }
} else {
    // Diagnostik jika $_FILES kosong pada request POST
    $error_msg = "Tidak ada file yang diterima";
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_FILES)) {
        $post_max = ini_get('post_max_size');
        $upload_max = ini_get('upload_max_filesize');
        $content_length = $_SERVER['CONTENT_LENGTH'] ?? 'unknown';
        $error_msg = "File tidak terdeteksi oleh server. Kemungkinan besar ukuran file ($content_length bytes) melebihi batas server (post_max_size: $post_max, upload_max_filesize: $upload_max).";
    }
    echo json_encode(["ok" => false, "error" => $error_msg]);
}
