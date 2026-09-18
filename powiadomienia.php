<?php
// ============================================================
// api/powiadomienia.php — GET, PUT (przeczytane), DELETE
// ============================================================
require_once __DIR__ . '/db.php';
wymagajZalogowania();

$metoda = $_SERVER['REQUEST_METHOD'];

if ($metoda === 'GET') {
    $odbiorca = $_GET['odbiorca'] ?? null;

    if ($odbiorca === 'admin') {
        wymagajAdmina();
        $stmt = $pdo->query('SELECT * FROM powiadomienia WHERE odbiorca = "admin" ORDER BY utworzono DESC');
    } elseif ($odbiorca === 'pracownik') {
        wymagajPracownika();
        $stmt = $pdo->prepare('SELECT * FROM powiadomienia WHERE odbiorca = "pracownik" AND email = ? ORDER BY utworzono DESC');
        $stmt->execute([$_SESSION['email']]);
    } else {
        bladOdpowiedz('Podaj prawidłowy parametr odbiorca (admin lub pracownik).');
    }

    echo json_encode($stmt->fetchAll());
    exit;
}

function przefiltrujDoWlasnych($pdo, $ids) {
    if (empty($ids)) {
        return [];
    }

    // Walidujemy, by tablica zawierała wyłącznie liczby całkowite
    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (empty($ids)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    if ($_SESSION['rola'] === 'admin') {
        $stmt = $pdo->prepare("SELECT id FROM powiadomienia WHERE odbiorca = 'admin' AND id IN ($placeholders)");
        $stmt->execute($ids);
    } else {
        $parametry = array_merge([$_SESSION['email']], $ids);
        $stmt = $pdo->prepare("SELECT id FROM powiadomienia WHERE odbiorca = 'pracownik' AND email = ? AND id IN ($placeholders)");
        $stmt->execute($parametry);
    }

    return array_column($stmt->fetchAll(), 'id');
}

if ($metoda === 'PUT') {
    $d = odczytajJson();
    $wlasne = przefiltrujDoWlasnych($pdo, $d['ids'] ?? []);

    if (empty($wlasne)) {
        echo json_encode(['sukces' => true]);
        exit;
    }

    $placeholders = implode(',', array_fill(0, count($wlasne), '?'));
    $pdo->prepare("UPDATE powiadomienia SET przeczytane = 1 WHERE id IN ($placeholders)")->execute($wlasne);
    echo json_encode(['sukces' => true]);
    exit;
}

if ($metoda === 'DELETE') {
    $idsWejsciowe = [];

    if (!empty($_GET['ids'])) {
        $idsWejsciowe = explode(',', $_GET['ids']);
    } elseif (!empty($_GET['id'])) {
        $idsWejsciowe = [$_GET['id']];
    }

    $wlasne = przefiltrujDoWlasnych($pdo, $idsWejsciowe);

    if (empty($wlasne)) {
        echo json_encode(['sukces' => true]);
        exit;
    }

    $placeholders = implode(',', array_fill(0, count($wlasne), '?'));
    $pdo->prepare("DELETE FROM powiadomienia WHERE id IN ($placeholders)")->execute($wlasne);
    echo json_encode(['sukces' => true]);
    exit;
}

bladOdpowiedz('Nieobsługiwana metoda.', 405);