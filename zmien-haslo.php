<?php
// ============================================================
// api/zmien-haslo.php — POST {hasloObecne, hasloNowe}
// Zmienia hasło WYŁĄCZNIE własnego, zalogowanego konta (z sesji).
// ============================================================
require_once __DIR__ . '/db.php';
wymagajZalogowania();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bladOdpowiedz('Nieobsługiwana metoda.', 405);
}

$d = odczytajJson();
$hasloObecne = $d['hasloObecne'] ?? '';<?php
// ============================================================
// api/zmien-haslo.php — Zmiana hasła z potwierdzeniem i siłą
// ============================================================
require_once __DIR__ . '/db.php';
wymagajZalogowania();
weryfikujCsrf(); // Blokada CSRF

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bladOdpowiedz('Nieobsługiwana metoda.', 405);
}

$d = odczytajJson();
$hasloObecne  = $d['hasloObecne'] ?? '';
$hasloNowe     = $d['hasloNowe'] ?? '';
$hasloPowtorz  = $d['hasloPowtorz'] ?? '';

if (!$hasloObecne || !$hasloNowe || !$hasloPowtorz) {
    bladOdpowiedz('Wypełnij wszystkie pola.');
}

if ($hasloNowe !== $hasloPowtorz) {
    bladOdpowiedz('Nowe hasło i jego powtórzenie nie są identyczne.');
}

// Walidacja złożoności hasła (min 8 znaków, min 1 cyfra, min 1 duża litera)
if (mb_strlen($hasloNowe) < 8) {
    bladOdpowiedz('Hasło musi mieć co najmniej 8 znaków.');
}
if (!preg_match('/[A-Z]/', $hasloNowe)) {
    bladOdpowiedz('Hasło musi zawierać co najmniej jedną wielką literę.');
}
if (!preg_match('/[0-9]/', $hasloNowe)) {
    bladOdpowiedz('Hasło musi zawierać co najmniej jedną cyfrę.');
}

// Sprawdzenie poprawności obecnego hasła
$stmt = $pdo->prepare('SELECT haslo FROM konta WHERE id = ? LIMIT 1');
$stmt->execute([$_SESSION['kontoId']]);
$konto = $stmt->fetch();

if (!$konto || !password_verify($hasloObecne, $konto['haslo'])) {
    usleep(300000);
    bladOdpowiedz('Obecne hasło jest nieprawidłowe.');
}

$nowyHash = password_hash($hasloNowe, PASSWORD_DEFAULT);
$update = $pdo->prepare('UPDATE konta SET haslo = ? WHERE id = ?');
$update->execute([$nowyHash, $_SESSION['kontoId']]);

session_regenerate_id(true);

echo json_encode(['sukces' => true]);

$hasloNowe    = $d['hasloNowe'] ?? '';

if (!$hasloObecne || !$hasloNowe) {
    bladOdpowiedz('Podaj obecne i nowe hasło.');
}
if (mb_strlen($hasloNowe) < 8) {
    bladOdpowiedz('Nowe hasło musi mieć co najmniej 8 znaków.');
}

$stmt = $pdo->prepare('SELECT haslo FROM konta WHERE id = ? LIMIT 1');
$stmt->execute([$_SESSION['kontoId']]);
$konto = $stmt->fetch();

if (!$konto || !password_verify($hasloObecne, $konto['haslo'])) {
    // Opóźnienie przeciw próbom zgadywania obecnego hasła
    usleep(300000);
    bladOdpowiedz('Obecne hasło jest nieprawidłowe.');
}

$nowyHash = password_hash($hasloNowe, PASSWORD_DEFAULT);
$update = $pdo->prepare('UPDATE konta SET haslo = ? WHERE id = ?');
$update->execute([$nowyHash, $_SESSION['kontoId']]);

// Zabezpieczenie sesji po zmianie hasła
session_regenerate_id(true);

echo json_encode(['sukces' => true]);