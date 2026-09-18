-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Wrz 18, 2026 at 08:43 AM
-- Wersja serwera: 10.4.32-MariaDB
-- Wersja PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `wypożyczalnia`
--

-- --------------------------------------------------------

--
-- Struktura tabeli dla tabeli `konta`
--

CREATE TABLE `konta` (
  `id` int(11) NOT NULL,
  `email` varchar(150) NOT NULL,
  `imie` varchar(150) NOT NULL,
  `dzial` varchar(100) NOT NULL,
  `rola` enum('pracownik','admin') NOT NULL DEFAULT 'pracownik',
  `haslo` varchar(255) NOT NULL,
  `utworzono` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `konta`
--

INSERT INTO `konta` (`id`, `email`, `imie`, `dzial`, `rola`, `haslo`, `utworzono`) VALUES
(1, 'serhiibielan7@gmail.com', 'Serhii Bielan', 'Praktykan', 'pracownik', '$2y$10$joPhJlmHS2QX3pjUM6ZKk.najHgoE0DA8G8LhpyOLlS0W/DF4bfGK', '2026-09-14 08:43:51'),
(2, 'admin@hexonic.com', 'Administrator IT', 'Dział IT', 'admin', '$2y$10$6D7GSPcR9BlD6xabCh/Q4eYoetfdfMn3Up4UlceXcDNxgKO8zFiwe', '2026-09-15 08:15:27');

-- --------------------------------------------------------

--
-- Struktura tabeli dla tabeli `powiadomienia`
--

CREATE TABLE `powiadomienia` (
  `id` int(11) NOT NULL,
  `wniosekId` int(11) DEFAULT NULL,
  `typ` varchar(30) NOT NULL,
  `tresc` text NOT NULL,
  `odbiorca` enum('admin','pracownik') NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `kluczDnia` varchar(10) DEFAULT NULL,
  `utworzono` datetime DEFAULT current_timestamp(),
  `przeczytane` tinyint(1) NOT NULL DEFAULT 0,
  `wyslanoMailem` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `powiadomienia`
--

INSERT INTO `powiadomienia` (`id`, `wniosekId`, `typ`, `tresc`, `odbiorca`, `email`, `kluczDnia`, `utworzono`, `przeczytane`, `wyslanoMailem`) VALUES
(6, 2, 'jutro', 'Twoja rezerwacja laptopa (L0003) wygasa jutro — 2026-09-18. Pamiętaj o zwrocie.', 'pracownik', 'serhiibielan7@gmail.com', '', '2026-09-17 10:49:24', 0, 1),
(7, 2, 'jutro', 'Rezerwacja laptopa (L0003) dla Serhii Bielan (Praktykan) wygasa jutro — 2026-09-18.', 'admin', NULL, '', '2026-09-17 10:49:24', 1, 0);

-- --------------------------------------------------------

--
-- Struktura tabeli dla tabeli `proby_logowania`
--

CREATE TABLE `proby_logowania` (
  `id` int(11) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `email` varchar(190) NOT NULL,
  `czas` datetime NOT NULL,
  `sukces` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `proby_logowania`
--

INSERT INTO `proby_logowania` (`id`, `ip`, `email`, `czas`, `sukces`) VALUES
(1, '::1', 'admin@hexonic.com', '2026-09-18 08:28:18', 0),
(2, '::1', 'admin@hexonic.com', '2026-09-18 08:28:19', 0),
(3, '::1', 'admin@hexonic.com', '2026-09-18 08:28:20', 0),
(4, '::1', 'admin@hexonic.com', '2026-09-18 08:28:20', 0),
(5, '::1', 'admin@hexonic.com', '2026-09-18 08:28:21', 0);

-- --------------------------------------------------------

--
-- Struktura tabeli dla tabeli `sprzet`
--

CREATE TABLE `sprzet` (
  `id` varchar(10) NOT NULL,
  `model` varchar(150) NOT NULL,
  `sn` varchar(100) DEFAULT NULL,
  `status` enum('Dostępny','Wypożyczony','W naprawie') NOT NULL DEFAULT 'Dostępny',
  `notatki` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sprzet`
--

INSERT INTO `sprzet` (`id`, `model`, `sn`, `status`, `notatki`) VALUES
('L0001', 'Dell Latitude 5440', 'SN-10021', 'Dostępny', NULL),
('L0002', 'Dell Latitude 5440', 'SN-10022', 'Dostępny', NULL),
('L0003', 'Lenovo ThinkPad T14', 'SN-20051', 'Wypożyczony', NULL),
('L0004', 'Lenovo ThinkPad T14', 'SN-20052', 'W naprawie', 'Wymiana klawiatury'),
('L0005', 'HP EliteBook 840', 'SN-30110', 'Dostępny', NULL);

-- --------------------------------------------------------

--
-- Struktura tabeli dla tabeli `wnioski`
--

CREATE TABLE `wnioski` (
  `id` int(11) NOT NULL,
  `kontoId` int(11) NOT NULL,
  `dataOd` date NOT NULL,
  `dataDo` date NOT NULL,
  `cel` varchar(255) NOT NULL,
  `uzasadnienie` text DEFAULT NULL,
  `powodOdmowy` text DEFAULT NULL,
  `status` enum('Oczekujący','Wydany','Zwrócony','Anulowany') NOT NULL DEFAULT 'Oczekujący',
  `laptopId` varchar(10) DEFAULT NULL,
  `prosbaNowaDataDo` date DEFAULT NULL,
  `prosbaUzasadnienie` text DEFAULT NULL,
  `utworzono` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `wnioski`
--

INSERT INTO `wnioski` (`id`, `kontoId`, `dataOd`, `dataDo`, `cel`, `uzasadnienie`, `powodOdmowy`, `status`, `laptopId`, `prosbaNowaDataDo`, `prosbaUzasadnienie`, `utworzono`) VALUES
(2, 1, '2026-09-17', '2026-09-18', 'projekt', NULL, NULL, 'Wydany', 'L0003', NULL, NULL, '2026-09-17 10:48:59');

--
-- Indeksy dla zrzutów tabel
--

--
-- Indeksy dla tabeli `konta`
--
ALTER TABLE `konta`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indeksy dla tabeli `powiadomienia`
--
ALTER TABLE `powiadomienia`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_powiadomienia_wniosek` (`wniosekId`);

--
-- Indeksy dla tabeli `proby_logowania`
--
ALTER TABLE `proby_logowania`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ip_czas` (`ip`,`czas`),
  ADD KEY `idx_email_czas` (`email`,`czas`);

--
-- Indeksy dla tabeli `sprzet`
--
ALTER TABLE `sprzet`
  ADD PRIMARY KEY (`id`);

--
-- Indeksy dla tabeli `wnioski`
--
ALTER TABLE `wnioski`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_wnioski_konto` (`kontoId`),
  ADD KEY `fk_wnioski_laptop` (`laptopId`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `konta`
--
ALTER TABLE `konta`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `powiadomienia`
--
ALTER TABLE `powiadomienia`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `proby_logowania`
--
ALTER TABLE `proby_logowania`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `wnioski`
--
ALTER TABLE `wnioski`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `powiadomienia`
--
ALTER TABLE `powiadomienia`
  ADD CONSTRAINT `fk_powiadomienia_wniosek` FOREIGN KEY (`wniosekId`) REFERENCES `wnioski` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `wnioski`
--
ALTER TABLE `wnioski`
  ADD CONSTRAINT `fk_wnioski_konto` FOREIGN KEY (`kontoId`) REFERENCES `konta` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_wnioski_laptop` FOREIGN KEY (`laptopId`) REFERENCES `sprzet` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
