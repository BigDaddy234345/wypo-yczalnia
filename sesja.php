<?php
// ============================================================
// api/sesja.php — Weryfikacja sesji i pobieranie tokenu CSRF
// ============================================================
require_once __DIR__ . '/db.php';

if (empty($_SESSION['kontoId'])) {
    echo json_encode([
        'zalogowany' => false,
        'csrfToken'  => $_SESSION['csrf_token']
    ]);
    exit;
}

$stmt = $pdo->prepare('SELECT id, email, imie, dzial, rola FROM konta WHERE id = ? LIMIT 1');
$stmt->execute([$_SESSION['kontoId']]);
$konto = $stmt->fetch();

if (!$konto) {
    $_SESSION = [];
    session_destroy();
    echo json_encode(['zalogowany' => false]);
    exit;
}

echo json_encode([
    'zalogowany' => true,
    'konto'      => $konto,
    'csrfToken'  => $_SESSION['csrf_token']
]);