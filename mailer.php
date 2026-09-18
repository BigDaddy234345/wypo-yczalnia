<?php
// ============================================================
// api/mailer.php — Wspólna funkcja wysyłki poczty przez PHPMailer
// ============================================================

require_once __DIR__ . '/../PHPMailer/src/Exception.php';
require_once __DIR__ . '/../PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/**
 * Wysyła wiadomość e-mail przez bezpieczne połączenie SMTP.
 * 
 * @param string $emailPracownika
 * @param string $tresc
 * @param string|null &$bladWyjscie
 * @return bool
 */
function wyslijMailDoPracownika($emailPracownika, $tresc, &$bladWyjscie = null): bool {
    if (!filter_var($emailPracownika, FILTER_VALIDATE_EMAIL)) {
        $bladWyjscie = 'Niepoprawny format adresu e-mail.';
        return false;
    }

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = 'secespol.home.pl';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'wypozyczalniait+hexonic_com.secespol';
        $mail->Password   = 'PcC3nHwtkI'; // Pamiętaj o zmianie hasła w panelu i tutaj

        // Szyfrowanie połączenia: Port 587 (STARTTLS) lub 465 (SMTPS)
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->Timeout    = 10; // Maksymalnie 10 sekund na odpowiedź serwera

        $mail->setFrom('wypozyczalniait@hexonic.com', 'Ewidencja IT — Wypożyczalnia laptopów');
        $mail->addAddress($emailPracownika);

        $mail->CharSet = 'UTF-8';
        $mail->isHTML(false);
        $mail->Subject = 'Ewidencja IT — powiadomienie o wypożyczeniu';
        $mail->Body    = $tresc;

        $mail->send();
        return true;
    } catch (Exception $e) {
        $bladWyjscie = $mail->ErrorInfo;
        error_log('Błąd wysyłki e-mail: ' . $mail->ErrorInfo);
        return false;
    }
}