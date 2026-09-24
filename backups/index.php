<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Ditangguhkan</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 50px 40px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .icon {
            font-size: 80px;
            margin-bottom: 20px;
        }
        h1 {
            color: #e74c3c;
            font-size: 28px;
            margin-bottom: 20px;
        }
        .message {
            color: #555;
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 30px;
        }
        .highlight {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .highlight strong {
            color: #856404;
        }
        .contact {
            color: #888;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .contact a {
            color: #3498db;
            text-decoration: none;
        }
        .contact a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">⚠️</div>
        <h1>Website Ditangguhkan</h1>

        <div class="message">
            Mohon maaf, saat ini website sedang ditangguhkan.
            <br><br>
            Untuk dapat mengakses website kembali, harap segera memperbarui layanan database Anda.
        </div>

        <div class="highlight">
            <strong>⚡ Langkah yang perlu dilakukan:</strong>
            <br><br>
            1. Perbarui atau aktifkan layanan database Anda
            <br>
            2. Pastikan konfigurasi koneksi database sudah benar
            <br>
            3. Hubungi administrator jika masalah berlanjut
        </div>

        <div class="message">
            Setelah layanan database diperbarui, website akan dapat digunakan kembali secara normal.
        </div>

        <div class="contact">
            Butuh bantuan? Hubungi administrator sistem.
        </div>
    </div>
</body>
</html>
