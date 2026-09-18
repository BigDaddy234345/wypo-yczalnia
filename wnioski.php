<?php
// ============================================================
// api/wnioski.php — Zarządzanie rezerwacjami i wnioskami
// ============================================================
require_once __DIR__ . '/db.php';
wymagajZalogowania();

$metoda = $_SERVER['REQUEST_METHOD'];

function sprawdzFormatDaty($data) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
        return false;
    }
    [$rok, $miesiac, $dzien] = explode('-', $data);
    return checkdate((int)$miesiac, (int)$dzien, (int)$rok);
}

function pobierzWniosek($pdo, $id) {
    $stmt = $pdo->prepare('
        SELECT w.*, k.imie, k.dzial, k.email
        FROM wnioski w JOIN konta k ON k.id = w.kontoId
        WHERE w.id = ?
    ');
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function dodajPowiadomienieWewnetrznie($pdo, $wniosekId, $typ, $tresc, $odbiorca, $email, $kluczDnia = null) {
    $stmt = $pdo->prepare('INSERT INTO powiadomienia (wniosekId, typ, tresc, odbiorca, email, kluczDnia) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$wniosekId, $typ, $tresc, $odbiorca, $email, $kluczDnia]);
}

if ($metoda === 'GET') {
    $stmt = $pdo->query('
        SELECT w.*, k.imie, k.dzial, k.email
        FROM wnioski w JOIN konta k ON k.id = w.kontoId
        ORDER BY w.dataOd
    ');
    $wszystkie = $stmt->fetchAll();

    if ($_SESSION['rola'] === 'pracownik') {
        // Anonimizacja danych innych pracowników (RODO / Minimalizacja danych)
        foreach ($wszystkie as &$w) {
            if ($w['kontoId'] != $_SESSION['kontoId']) {
                $w['imie'] = null;
                $w['dzial'] = null;
                $w['email'] = null;
                $w['cel'] = null;
                $w['uzasadnienie'] = null;
                $w['powodOdmowy'] = null;
                $w['prosbaNowaDataDo'] = null;
                $w['prosbaUzasadnienie'] = null;
            }
        }
        unset($w);
    }

    echo json_encode($wszystkie);
    exit;
}

if ($metoda === 'POST') {
    $kontoId = wymagajPracownika();
    $d = odczytajJson();
    $dataOd       = trim($d['dataOd'] ?? '');
    $dataDo       = trim($d['dataDo'] ?? '');
    $cel          = trim($d['cel'] ?? '');
    $uzasadnienie = trim($d['uzasadnienie'] ?? '');
    $dzis         = date('Y-m-d');

    if (!$dataOd || !$dataDo || !$cel) {
        bladOdpowiedz('Uzupełnij wszystkie wymagane pola.');
    }
    if (!sprawdzFormatDaty($dataOd) || !sprawdzFormatDaty($dataDo)) {
        bladOdpowiedz('Nieprawidłowy format daty (wymagany YYYY-MM-DD).');
    }
    if ($dataOd > $dataDo) {
        bladOdpowiedz('Data „od” nie może być późniejsza niż data „do”.');
    }
    if ($dataOd < $dzis) {
        bladOdpowiedz('Nie można składać wniosków z datą z przeszłości.');
    }

    // Blokada drugiej aktywnej rezerwacji
    $sprawdz = $pdo->prepare("SELECT COUNT(*) AS liczba FROM wnioski WHERE kontoId = ? AND status IN ('Oczekujący','Wydany')");
    $sprawdz->execute([$kontoId]);
    if ($sprawdz->fetch()['liczba'] > 0) {
        bladOdpowiedz('Masz już aktywną rezerwację — nie możesz złożyć kolejnej.');
    }

    $stmt = $pdo->prepare('
        INSERT INTO wnioski (kontoId, dataOd, dataDo, cel, uzasadnienie, status)
        VALUES (?, ?, ?, ?, ?, "Oczekujący")
    ');
    $stmt->execute([$kontoId, $dataOd, $dataDo, $cel, $uzasadnienie ?: null]);
    echo json_encode(['sukces' => true, 'id' => (int)$pdo->lastInsertId()]);
    exit;
}

if ($metoda === 'PUT') {
    $d = odczytajJson();
    $id    = filter_var($d['id'] ?? null, FILTER_VALIDATE_INT);
    $akcja = trim($d['akcja'] ?? '');

    if (!$id || !$akcja) {
        bladOdpowiedz('Brak identyfikatora wniosku lub akcji.');
    }

    $w = pobierzWniosek($pdo, $id);
    if (!$w) {
        bladOdpowiedz('Nie znaleziono wniosku.', 404);
    }

    // Autoryzacja ról
    $akcjePracownika = ['oddaj', 'poprosPrzedluzenie'];
    if (in_array($akcja, $akcjePracownika, true)) {
        $kontoId = wymagajPracownika();
        if ($w['kontoId'] != $kontoId) {
            bladOdpowiedz('To nie jest Twój wniosek.', 403);
        }
    } else {
        wymagajAdmina();
    }

    switch ($akcja) {

        case 'przypisz': {
            $laptopId = trim($d['laptopId'] ?? '') ?: null;
            $stary = $w['laptopId'];

            $pdo->beginTransaction();
            try {
                if ($stary && $stary !== $laptopId) {
                    $pdo->prepare("UPDATE sprzet SET status = 'Dostępny' WHERE id = ? AND status = 'Wypożyczony'")->execute([$stary]);
                }
                if ($laptopId) {
                    // Sprawdzamy czy laptop nie jest w naprawie
                    $spr = $pdo->prepare('SELECT status FROM sprzet WHERE id = ?');
                    $spr->execute([$laptopId]);
                    $sprzet = $spr->fetch();
                    if (!$sprzet || $sprzet['status'] === 'W naprawie') {
                        $pdo->rollBack();
                        bladOdpowiedz('Wybrany laptop jest w naprawie lub nie istnieje.');
                    }
                }
                $pdo->prepare('UPDATE wnioski SET laptopId = ? WHERE id = ?')->execute([$laptopId, $id]);
                $pdo->commit();
                echo json_encode(['sukces' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                bladOdpowiedz('Wystąpił błąd podczas przypisywania sprzętu.', 500);
            }
            break;
        }

        case 'wydaj': {
            if ($w['status'] !== 'Oczekujący') {
                bladOdpowiedz('Można wydać sprzęt tylko do wniosku oczekującego.');
            }
            if (!$w['laptopId']) {
                bladOdpowiedz('Najpierw przypisz laptop do tego wniosku.');
            }

            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE wnioski SET status = 'Wydany' WHERE id = ?")->execute([$id]);
                $pdo->prepare("UPDATE sprzet SET status = 'Wypożyczony' WHERE id = ?")->execute([$w['laptopId']]);
                $pdo->commit();
                echo json_encode(['sukces' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                bladOdpowiedz('Błąd podczas wydawania sprzętu.', 500);
            }
            break;
        }

        case 'zwroc':
        case 'oddaj': {
            // Bezpieczeństwo maszyny stanów: zwrot możliwy tylko jeśli sprzęt był faktycznie wydany
            if ($w['status'] !== 'Wydany') {
                bladOdpowiedz('Można zwrócić wyłącznie wniosek o statusie „Wydany”.');
            }

            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE wnioski SET status = 'Zwrócony' WHERE id = ?")->execute([$id]);
                if ($w['laptopId']) {
                    $pdo->prepare("UPDATE sprzet SET status = 'Dostępny' WHERE id = ? AND status <> 'W naprawie'")->execute([$w['laptopId']]);
                }
                if ($akcja === 'oddaj') {
                    dodajPowiadomienieWewnetrznie($pdo, $id, 'info',
                        "{$w['imie']} ({$w['dzial']}) oddał(a) laptop " . ($w['laptopId'] ?: '') . " — wniosek zamknięty.",
                        'admin', null);
                }
                $pdo->commit();
                echo json_encode(['sukces' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                bladOdpowiedz('Błąd podczas rejestrowania zwrotu.', 500);
            }
            break;
        }

        case 'odrzuc': {
            if ($w['status'] !== 'Oczekujący') {
                bladOdpowiedz('Można odrzucić wyłącznie oczekujący wniosek.');
            }
            $powod = trim($d['powod'] ?? '');
            $pdo->beginTransaction();
            try {
                if ($w['laptopId']) {
                    $pdo->prepare("UPDATE sprzet SET status = 'Dostępny' WHERE id = ? AND status = 'Wypożyczony'")->execute([$w['laptopId']]);
                }
                $pdo->prepare('UPDATE wnioski SET status = "Anulowany", powodOdmowy = ?, laptopId = NULL WHERE id = ?')
                    ->execute([$powod ?: null, $id]);
                $tresc = "Twoje zgłoszenie na laptopa ({$w['dataOd']} – {$w['dataDo']}) zostało odrzucone przez Dział IT."
                       . ($powod ? " Powód: {$powod}" : "");
                dodajPowiadomienieWewnetrznie($pdo, $id, 'info', $tresc, 'pracownik', $w['email']);
                $pdo->commit();
                echo json_encode(['sukces' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                bladOdpowiedz('Błąd podczas odrzucania wniosku.', 500);
            }
            break;
        }

        case 'edytujDaty': {
            $dataOd = trim($d['dataOd'] ?? $w['dataOd']);
            $dataDo = trim($d['dataDo'] ?? $w['dataDo']);

            if (!sprawdzFormatDaty($dataOd) || !sprawdzFormatDaty($dataDo)) {
                bladOdpowiedz('Nieprawidłowy format dat.');
            }
            if ($dataOd > $dataDo) {
                bladOdpowiedz('Data „od” nie może być późniejsza niż data „do”.');
            }
            $pdo->prepare('UPDATE wnioski SET dataOd = ?, dataDo = ? WHERE id = ?')->execute([$dataOd, $dataDo, $id]);
            echo json_encode(['sukces' => true]);
            break;
        }

        case 'przedluz': {
            $dataDo = trim($d['dataDo'] ?? '');
            if (!sprawdzFormatDaty($dataDo) || $dataDo <= $w['dataDo']) {
                bladOdpowiedz('Podaj poprawną nową datę zwrotu późniejszą niż obecna.');
            }
            $pdo->prepare('UPDATE wnioski SET dataDo = ? WHERE id = ?')->execute([$dataDo, $id]);
            echo json_encode(['sukces' => true]);
            break;
        }

        case 'poprosPrzedluzenie': {
            if ($w['status'] !== 'Wydany') {
                bladOdpowiedz('Możesz poprosić o przedłużenie tylko aktywnego, wydanego wypożyczenia.');
            }
            $nowaDataDo   = trim($d['nowaDataDo'] ?? '');
            $uzasadnienie = trim($d['uzasadnienie'] ?? '');

            if (!sprawdzFormatDaty($nowaDataDo) || $nowaDataDo <= $w['dataDo']) {
                bladOdpowiedz('Podaj poprawną datę zwrotu (późniejszą niż obecna).');
            }

            $pdo->prepare('UPDATE wnioski SET prosbaNowaDataDo = ?, prosbaUzasadnienie = ? WHERE id = ?')
                ->execute([$nowaDataDo, $uzasadnienie ?: null, $id]);
            dodajPowiadomienieWewnetrznie($pdo, $id, 'info',
                "{$w['imie']} ({$w['dzial']}) prosi o przedłużenie wypożyczenia laptopa " . ($w['laptopId'] ?: '') . " do {$nowaDataDo}.",
                'admin', null);
            echo json_encode(['sukces' => true]);
            break;
        }

        case 'akceptujPrzedluzenie': {
            if (!$w['prosbaNowaDataDo']) {
                bladOdpowiedz('Brak oczekującej prośby o przedłużenie.');
            }
            $nowaData = $w['prosbaNowaDataDo'];
            $pdo->prepare('UPDATE wnioski SET dataDo = ?, prosbaNowaDataDo = NULL, prosbaUzasadnienie = NULL WHERE id = ?')
                ->execute([$nowaData, $id]);
            dodajPowiadomienieWewnetrznie($pdo, $id, 'info',
                "Twoja prośba o przedłużenie wypożyczenia do {$nowaData} została zaakceptowana.",
                'pracownik', $w['email']);
            echo json_encode(['sukces' => true]);
            break;
        }

        case 'odrzucPrzedluzenie': {
            $powod = trim($d['powod'] ?? '');
            $pdo->prepare('UPDATE wnioski SET prosbaNowaDataDo = NULL, prosbaUzasadnienie = NULL WHERE id = ?')->execute([$id]);
            dodajPowiadomienieWewnetrznie($pdo, $id, 'info',
                "Twoja prośba o przedłużenie wypożyczenia została odrzucona." . ($powod ? " Powód: {$powod}" : ""),
                'pracownik', $w['email']);
            echo json_encode(['sukces' => true]);
            break;
        }

        default:
            bladOdpowiedz('Nieznana akcja.');
    }
    exit;
}

if ($metoda === 'DELETE') {
    wymagajAdmina();
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$id) {
        bladOdpowiedz('Brak identyfikatora wniosku.');
    }

    $w = pobierzWniosek($pdo, $id);
    if (!$w) {
        bladOdpowiedz('Wniosek nie istnieje.', 404);
    }

    $pdo->beginTransaction();
    try {
        if ($w['status'] === 'Wydany' && $w['laptopId']) {
            $pdo->prepare("UPDATE sprzet SET status = 'Dostępny' WHERE id = ? AND status <> 'W naprawie'")->execute([$w['laptopId']]);
        }
        $pdo->prepare('DELETE FROM powiadomienia WHERE wniosekId = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM wnioski WHERE id = ?')->execute([$id]);
        $pdo->commit();
        echo json_encode(['sukces' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('Błąd podczas usuwania wniosku: ' . $e->getMessage());
        bladOdpowiedz('Błąd podczas usuwania wniosku.', 500);
    }
    exit;
}
