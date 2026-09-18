<?php
// ============================================================
// api/sprawdz-powiadomienia.php — Skaner terminów i powiadomień
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';

// Poprawiona literówka: było wymagaLogowania() -> musi być wymagajZalogowania()
wymagajZalogowania();

$dzisiaj = date('Y-m-d');

$stmt = $pdo->query("
    SELECT w.*, k.imie, k.dzial, k.email
    FROM wnioski w 
    JOIN konta k ON k.id = w.kontoId
    WHERE w.status = 'Wydany'
");
$wnioski = $stmt->fetchAll();

$dodaneLacznie = 0;
$mailWyslane   = 0;

$wstaw = $pdo->prepare('
    INSERT INTO powiadomienia (wniosekId, typ, tresc, odbiorca, email, kluczDnia, wyslanoMailem)
    VALUES (?, ?, ?, ?, ?, ?, ?)
');

$sprawdzIstniejace = $pdo->prepare('
    SELECT COUNT(*) AS liczba FROM powiadomienia
    WHERE wniosekId = ? AND typ = ? AND odbiorca = ? AND kluczDnia = ?
');

foreach ($wnioski as $w) {
    $roznicaDni = (strtotime($w['dataDo']) - strtotime($dzisiaj)) / 86400;

    $typ = null;
    if ($roznicaDni == 1) {
        $typ = 'jutro';
    } elseif ($roznicaDni == 0) {
        $typ = 'dzisiaj';
    } elseif ($roznicaDni < 0) {
        $typ = 'przeterminowany';
    }

    if (!$typ) {
        continue;
    }

    $kluczDnia  = ($typ === 'przeterminowany') ? $dzisiaj : '';
    $laptopOpis = $w['laptopId'] ? "({$w['laptopId']}) " : '';

    $trescPracownika = [
        'jutro'           => "Twoja rezerwacja laptopa {$laptopOpis}wygasa jutro — {$w['dataDo']}. Pamiętaj o zwrocie.",
        'dzisiaj'         => "Twoja rezerwacja laptopa {$laptopOpis}wygasa dzisiaj — {$w['dataDo']}. Zwróć laptop do Działu IT.",
        'przeterminowany' => "Twoje wypożyczenie laptopa {$laptopOpis}jest przeterminowane od {$w['dataDo']}. Zwróć laptop jak najszybciej.",
    ][$typ];

    $trescAdmina = [
        'jutro'           => "Rezerwacja laptopa {$laptopOpis}dla {$w['imie']} ({$w['dzial']}) wygasa jutro — {$w['dataDo']}.",
        'dzisiaj'         => "Rezerwacja laptopa {$laptopOpis}dla {$w['imie']} ({$w['dzial']}) wygasa dzisiaj — {$w['dataDo']}.",
        'przeterminowany' => "Wypożyczenie laptopa {$laptopOpis}dla {$w['imie']} ({$w['dzial']}) jest przeterminowane od {$w['dataDo']}.",
    ][$typ];

    // 1. Powiadomienie dla pracownika
    $sprawdzIstniejace->execute([$w['id'], $typ, 'pracownik', $kluczDnia]);
    if ((int)$sprawdzIstniejace->fetch()['liczba'] === 0) {
        $blad = null;
        $wyslano = wyslijMailDoPracownika($w['email'], $trescPracownika, $blad);
        if ($wyslano) {
            $mailWyslane++;
        }
        $wstaw->execute([$w['id'], $typ, $trescPracownika, 'pracownik', $w['email'], $kluczDnia, $wyslano ? 1 : 0]);
        $dodaneLacznie++;
    }

    // 2. Powiadomienie dla Działu IT (admin)
    $sprawdzIstniejace->execute([$w['id'], $typ, 'admin', $kluczDnia]);
    if ((int)$sprawdzIstniejace->fetch()['liczba'] === 0) {
        $wstaw->execute([$w['id'], $typ, $trescAdmina, 'admin', null, $kluczDnia, 0]);
        $dodaneLacznie++;
    }
}

echo json_encode([
    'sukces'       => true,
    'dodane'       => $dodaneLacznie,
    'mailWyslane'  => $mailWyslane
]);