<?php
// ============================================================
// api/sprzet.php — GET (lista), POST (dodaj), PUT (edytuj), DELETE (?id=)
// ============================================================
require_once __DIR__ . '/db.php';

$metoda = $_SERVER['REQUEST_METHOD'];

wymagajZalogowania();
if ($metoda !== 'GET') {
    wymagajAdmina();
}

$dozwoloneStatusy = ['Dostępny', 'Wypożyczony', 'W naprawie'];

if ($metoda === 'GET') {
    $stmt = $pdo->query('SELECT id, model, sn, status, notatki FROM sprzet ORDER BY id');
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($metoda === 'POST') {
    $d = odczytajJson();
    $id     = trim($d['id'] ?? '');
    $model  = trim($d['model'] ?? '');
    $sn     = trim($d['sn'] ?? '') ?: null;
    $status = trim($d['status'] ?? 'Dostępny');
    $notatki = trim($d['notatki'] ?? '') ?: null;

    if (!$id || !$model) {
        bladOdpowiedz('Podaj nr inwentarzowy i model sprzętu.');
    }
    if (!in_array($status, $dozwoloneStatusy, true)) {
        bladOdpowiedz('Nieprawidłowy status sprzętu.');
    }

    $sprawdz = $pdo->prepare('SELECT id FROM sprzet WHERE id = ? LIMIT 1');
    $sprawdz->execute([$id]);
    if ($sprawdz->fetch()) {
        bladOdpowiedz('Laptop o tym numerze inwentarzowym już istnieje.');
    }

    $stmt = $pdo->prepare('INSERT INTO sprzet (id, model, sn, status, notatki) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$id, $model, $sn, $status, $notatki]);
    echo json_encode(['sukces' => true]);
    exit;
}

if ($metoda === 'PUT') {
    $d = odczytajJson();
    $id = trim($d['id'] ?? '');
    if (!$id) {
        bladOdpowiedz('Brak identyfikatora laptopa.');
    }

    $pola = [];
    $wartosci = [];

    if (isset($d['status'])) {
        $nowyStatus = trim($d['status']);
        if (!in_array($nowyStatus, $dozwoloneStatusy, true)) {
            bladOdpowiedz('Nieprawidłowy status sprzętu.');
        }
        $pola[] = 'status = ?';
        $wartosci[] = $nowyStatus;
    }

    if (isset($d['notatki'])) {
        $pola[] = 'notatki = ?';
        $wartosci[] = trim($d['notatki']) ?: null;
    }

    if (empty($pola)) {
        bladOdpowiedz('Brak pól do aktualizacji.');
    }

    $wartosci[] = $id;
    $stmt = $pdo->prepare('UPDATE sprzet SET ' . implode(', ', $pola) . ' WHERE id = ?');
    $stmt->execute($wartosci);
    echo json_encode(['sukces' => true]);
    exit;
}

if ($metoda === 'DELETE') {
    $id = trim($_GET['id'] ?? '');
    if (!$id) {
        bladOdpowiedz('Brak identyfikatora laptopa.');
    }

    // Blokada kasowania sprzętu, który jest aktualnie wydany lub wypożyczony
    $sprawdzWypozyczenie = $pdo->prepare("
        SELECT s.status, COUNT(w.id) AS aktywneWnioski
        FROM sprzet s
        LEFT JOIN wnioski w ON w.laptopId = s.id AND w.status = 'Wydany'
        WHERE s.id = ?
        GROUP BY s.id, s.status
    ");
    $sprawdzWypozyczenie->execute([$id]);
    $sprzetInfo = $sprawdzWypozyczenie->fetch();

    if ($sprzetInfo && ($sprzetInfo['status'] === 'Wypożyczony' || $sprzetInfo['aktywneWnioski'] > 0)) {
        bladOdpowiedz('Nie można usunąć sprzętu, który jest aktualnie wypożyczony użytkownikowi.');
    }

    $stmt = $pdo->prepare('DELETE FROM sprzet WHERE id = ?');
    $stmt->execute([$id]);
    echo json_encode(['sukces' => true]);
    exit;
}

bladOdpowiedz('Nieobsługiwana metoda.', 405);