<?php
// ============================================================
// api/db.php — Baza danych, sesje, CSRF i kontrola limitów
// ============================================================

$przezHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $przezHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// Inicjalizacja unikalnego tokenu CSRF dla sesji
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

header('Content-Type: application/json; charset=utf-8');

// Połączenie z bazą
$DB_HOST  = 'localhost';
$DB_NAZWA = 'wypożyczalnia'; // Sprawdź, czy w phpMyAdmin nie masz "wypozyczalnia"
$DB_USER  = 'root';
$DB_HASLO = '';

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAZWA};charset=utf8mb4",
        $DB_USER,
        $DB_HASLO,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    error_log('Błąd bazy danych: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['blad' => 'Błąd wewnętrzny serwera. Spróbuj ponownie później.']);
    exit;
}

function odczytajJson() {
    $dane = json_decode(file_get_contents('php://input'), true);
    return is_array($dane) ? $dane : [];
}

function bladOdpowiedz($tresc, $kod = 400) {
    http_response_code($kod);
    echo json_encode(['blad' => $tresc]);
    exit;
}

// --- ZABEZPIECZENIE CSRF (dla metod POST, PUT, DELETE) ---
function weryfikujCsrf() {
    $metoda = $_SERVER['REQUEST_METHOD'];
    if (in_array($metoda, ['POST', 'PUT', 'DELETE'], true)) {
        // Token może przyjść w nagłówku HTTP X-CSRF-Token lub w ciele JSON
        $tokenNaglowek = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        $dane = odczytajJson();
        $tokenBody = $dane['csrf_token'] ?? null;

        $przeslanyToken = $tokenNaglowek ?: $tokenBody;

        if (!$przeslanyToken || !hash_equals($_SESSION['csrf_token'] ?? '', $przeslanyToken)) {
            bladOdpowiedz('Błąd weryfikacji tokenu CSRF (odśwież stronę).', 403);
        }
    }
}

// --- RATE LIMITING / BLOKADA BRUTE-FORCE ---
function pobierzIpKlienta() {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function sprawdzBlokadeLogowania($pdo, $email, $ip) {
    // Limit: max 5 nieudanych prób w ciągu ostatnich 10 minut
    $oknoMinut = 10;
    $maxProb = 5;

    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS nieudane 
        FROM proby_logowania 
        WHERE (ip = ? OR email = ?) 
          AND sukces = 0 
          AND czas > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    ");
    $stmt->execute([$ip, $email, $oknoMinut]);
    $nieudane = (int)$stmt->fetch()['nieudane'];

    if ($nieudane >= $maxProb) {
        bladOdpowiedz("Zbyt wiele nieudanych prób logowania. Konto lub IP zostało tymczasowo zablokowane na $oknoMinut minut.", 429);
    }
}

function zarejestrujProbeLogowania($pdo, $email, $ip, $sukces) {
    $stmt = $pdo->prepare("
        INSERT INTO proby_logowania (ip, email, czas, sukces) 
        VALUES (?, ?, NOW(), ?)
    ");
    $stmt->execute([$ip, $email, $sukces ? 1 : 0]);
}

// --- STRAŻNICY UPRAWNIEŃ ---
function wymagajZalogowania() {
    if (empty($_SESSION['kontoId'])) {
        bladOdpowiedz('Musisz być zalogowany.', 401);
    }
}

function wymagajAdmina() {
    if (empty($_SESSION['kontoId']) || ($_SESSION['rola'] ?? '') !== 'admin') {
        bladOdpowiedz('Brak uprawnień administratora.', 403);
    }
}

function wymagajPracownika() {
    if (empty($_SESSION['kontoId']) || ($_SESSION['rola'] ?? '') !== 'pracownik') {
        bladOdpowiedz('Musisz być zalogowany jako pracownik.', 403);
    }
    return $_SESSION['kontoId'];
}
