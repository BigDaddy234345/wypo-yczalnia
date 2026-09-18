<?php
// ============================================================
// api/logowanie.php — Autoryzacja roli i ochrona sesji
// ============================================================
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bladOdpowiedz('Nieobsługiwana metoda.', 405);
}

$d = odczytajJson();
$email          = trim($d['email'] ?? '');
$haslo          = $d['haslo'] ?? '';
$oczekiwanaRola = trim($d['oczekiwanaRola'] ?? ''); // "admin" albo "pracownik"
$ip             = pobierzIpKlienta();

if (!$email || !$haslo) {
    bladOdpowiedz('Podaj e-mail i hasło.');
}

// 1. Sprawdzenie, czy użytkownik lub IP nie jest zablokowane (Brute-Force)
sprawdzBlokadeLogowania($pdo, $email, $ip);

// 2. Pobranie konta
$stmt = $pdo->prepare('SELECT id, email, imie, dzial, rola, haslo FROM konta WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$konto = $stmt->fetch();

// 3. Weryfikacja hasła
if (!$konto || !password_verify($haslo, $konto['haslo'])) {
    zarejestrujProbeLogowania($pdo, $email, $ip, false);
    usleep(300000); // 300 ms opóźnienia
    echo json_encode(['sukces' => false, 'blad' => 'Nieprawidłowy e-mail lub hasło.']);
    exit;
}

// 4. WERYFIKACJA ROLI PRZED UTWORZENIEM SESJI:
// Jeśli rola się nie zgadza, NIE TWORZYMY SESJI i natychmiast odrzucamy próbę!
if ($oczekiwanaRola && $konto['rola'] !== $oczekiwanaRola) {
    zarejestrujProbeLogowania($pdo, $email, $ip, false);
    $komunikat = ($oczekiwanaRola === 'admin') 
        ? 'Brak uprawnień administratora IT.' 
        : 'To konto nie jest kontem pracowniczym.';
    
    echo json_encode(['sukces' => false, 'blad' => $komunikat]);
    exit;
}

// 5. Dopiero tutaj logowanie jest w 100% autoryzowane — rejestrujemy sukces i tworzymy sesję
zarejestrujProbeLogowania($pdo, $email, $ip, true);

$_SESSION = [];
session_regenerate_id(true);

$_SESSION['kontoId'] = (int)$konto['id'];
$_SESSION['rola']    = $konto['rola'];
$_SESSION['email']   = $konto['email'];

unset($konto['haslo']);

echo json_encode([
    'sukces'    => true,
    'konto'     => $konto,
    'csrfToken' => $_SESSION['csrf_token']
]);
