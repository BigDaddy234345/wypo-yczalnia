<?php
// ============================================================
// api/wyloguj.php — kończy sesję serwerową
// ============================================================
require_once __DIR__ . '/db.php';

$_SESSION = [];
session_destroy();
echo json_encode(['sukces' => true]);