<?php
/**
 * acca_move.php
 * Memindahkan file secara fisik ke folder baru di hosting.
 *
 * POST params:
 *   file_url   - URL lengkap file saat ini (dari database)
 *   new_folder - Folder tujuan relatif terhadap uploads/
 *                Contoh: "Ahmad/Laporan Bulanan" atau "Ahmad/others"
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit;

$base_dir = 'uploads/';

$file_url = isset($_POST['file_url']) ? trim($_POST['file_url']) : '';
$new_folder = isset($_POST['new_folder']) ? trim($_POST['new_folder']) : '';

// Validasi input
if (empty($file_url)) {
    echo json_encode(['ok' => false, 'error' => 'Parameter file_url diperlukan']);
    exit;
}
if (empty($new_folder)) {
    echo json_encode(['ok' => false, 'error' => 'Parameter new_folder diperlukan']);
    exit;
}

// Ekstrak relative path dari URL
// Contoh URL: https://acca.icgowa.sch.id/uploads/Ahmad/Laporan/abcd1234.pdf
$url_path = parse_url($file_url, PHP_URL_PATH);
$parts = explode('/uploads/', $url_path, 2);

if (!isset($parts[1]) || empty($parts[1])) {
    echo json_encode(['ok' => false, 'error' => 'Format URL tidak valid, tidak ditemukan /uploads/ dalam URL', 'url' => $file_url]);
    exit;
}

$relative_path = urldecode($parts[1]); // misal: "Ahmad/Laporan/abcd1234.pdf"
$source_path = $base_dir . $relative_path;

// Periksa apakah file ada di sumber
if (!file_exists($source_path) || !is_file($source_path)) {
    echo json_encode(['ok' => false, 'error' => 'File tidak ditemukan di hosting', 'path' => $source_path]);
    exit;
}

// Filename (hanya nama file, tanpa folder)
$filename = basename($source_path);

// Bangun path tujuan
$target_dir = $base_dir . rtrim($new_folder, '/') . '/';
$target_path = $target_dir . $filename;

// Normalkan path untuk perbandingan
$real_source = realpath($source_path);
$normalized_target = $target_dir . $filename;

// Jika sudah di folder yang sama, tidak perlu dipindahkan
if ($real_source === @realpath($normalized_target)) {
    $new_url = buildUrl($target_path);
    echo json_encode(['ok' => true, 'publicUrl' => $new_url, 'message' => 'File sudah berada di folder tujuan']);
    exit;
}

// Buat folder tujuan jika belum ada
if (!file_exists($target_dir)) {
    if (!mkdir($target_dir, 0777, true)) {
        echo json_encode(['ok' => false, 'error' => 'Gagal membuat folder tujuan', 'dir' => $target_dir]);
        exit;
    }
}

// Pindahkan file
if (rename($source_path, $target_path)) {
    $new_url = buildUrl($target_path);
    echo json_encode([
        'ok' => true,
        'publicUrl' => $new_url,
        'message' => 'File berhasil dipindahkan',
        'from' => $source_path,
        'to' => $target_path,
    ]);
} else {
    echo json_encode([
        'ok' => false,
        'error' => 'Gagal memindahkan file (rename() gagal)',
        'from' => $source_path,
        'to' => $target_path,
    ]);
}

// Helper: bangun URL publik dari relative path
function buildUrl(string $rel_path): string
{
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $base_path = dirname($_SERVER['PHP_SELF']); // misal: /acca.icgowa.sch.id
    return $protocol . '://' . $host . $base_path . '/' . $rel_path;
}
