<?php
// ============================================================
// api/konta.php — GET (lista bez haseł), POST (załóż konto), DELETE (?id=)
// ============================================================
require_once __DIR__ . '/db.php';
wymagajAdmina();

$metoda = $_SERVER['REQUEST_METHOD'];

if ($metoda === 'GET') {
    $stmt = $pdo->query("SELECT id, email, imie, dzial, rola FROM konta WHERE rola = 'pracownik' ORDER BY imie");
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($metoda === 'POST') {
    $d = odczytajJson();
    $imie  = trim($d['imie'] ?? '');
    $dzial = trim($d['dzial'] ?? '');
    $email = trim($d['email'] ?? '');
    $haslo = $d['haslo'] ?? '';

    if (!$imie || !$dzial || !$email || !$haslo) {
        bladOdpowiedz('Uzupełnij wszystkie pola.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        bladOdpowiedz('Podaj poprawny adres e-mail.');
    }
    if (mb_strlen($haslo) < 8) {
        bladOdpowiedz('Hasło musi mieć co najmniej 8 znaków.');
    }

    // Sprawdzenie unikalności e-maila
    $sprawdz = $pdo->prepare('SELECT id FROM konta WHERE email = ? LIMIT 1');
    $sprawdz->execute([$email]);
    if ($sprawdz->fetch()) {
        bladOdpowiedz('Konto z tym adresem e-mail już istnieje.');
    }

    $hashHasla = password_hash($haslo, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO konta (email, imie, dzial, rola, haslo) VALUES (?, ?, ?, "pracownik", ?)');
    $stmt->execute([$email, $imie, $dzial, $hashHasla]);

    echo json_encode(['sukces' => true, 'id' => (int)$pdo->lastInsertId()]);
    exit;
}

if ($metoda === 'DELETE') {
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$id) {
        bladOdpowiedz('Nieprawidłowy identyfikator konta.');
    }

    // Blokada usunięcia samego siebie
    if ($id === (int)$_SESSION['kontoId']) {
        bladOdpowiedz('Nie możesz usunąć aktualnie zalogowanego konta administratora.');
    }

    // Blokada: nie usuwaj konta z aktywną rezerwacją (Oczekujący lub Wydany)
    $sprawdz = $pdo->prepare("SELECT COUNT(*) AS liczba FROM wnioski WHERE kontoId = ? AND status IN ('Oczekujący','Wydany')");
    $sprawdz->execute([$id]);
    if ($sprawdz->fetch()['liczba'] > 0) {
        bladOdpowiedz('Nie można usunąć konta z aktywną rezerwacją lub wypożyczonym sprzętem.');
    }

    try {
        $stmt = $pdo->prepare('DELETE FROM konta WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['sukces' => true]);
    } catch (PDOException $e) {
        error_log('Błąd usuwania konta: ' . $e->getMessage());
        bladOdpowiedz('Nie można usunąć konta powiązanego z historią wypożyczeń.', 409);
    }
    exit;
}

bladOdpowiedz('Nieobsługiwana metoda.', 405);