<?php
/**
 * Запасной обработчик заявок с сайта «Альфа-Холод».
 *
 * По умолчанию сайт использует FormSubmit и работает на GitHub Pages без PHP.
 * Этот скрипт нужен, если сайт переедет на хостинг с PHP: переключите
 * FORM_ENDPOINT в js/data.js на "send.php".
 *
 * Принимает POST-запросы с форм (multipart/form-data или urlencoded),
 * проверяет поля, ограничивает частоту отправок и отправляет письмо
 * администратору через функцию mail().
 *
 * Требования: PHP 7.0+ с включённой функцией mail().
 * Получателя можно изменить ниже или переменной окружения ALFAHOLOD_MAIL_TO.
 */

date_default_timezone_set('Europe/Moscow');
if (function_exists('mb_internal_encoding')) {
    mb_internal_encoding('UTF-8');
}

/* ---------- Настройки ---------- */

$MAIL_TO = getenv('ALFAHOLOD_MAIL_TO');
if (!$MAIL_TO) {
    $MAIL_TO = 'kozimirovdima23@gmail.com';
}

define('RATE_LIMIT', 5);      // не более 5 заявок
define('RATE_WINDOW', 900);   // за 15 минут с одного IP

/* ---------- Вспомогательные функции ---------- */

function respond($status, $payload)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function post_value($key, $maxLength = 600)
{
    if (!isset($_POST[$key]) || !is_string($_POST[$key])) {
        return '';
    }

    $value = str_replace("\0", '', $_POST[$key]);
    $value = str_replace(array("\r\n", "\r"), "\n", $value);
    $value = trim($value);

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }

    return substr($value, 0, $maxLength);
}

/* ---------- Только POST ---------- */

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';
if ($method !== 'POST') {
    respond(405, array('ok' => false, 'error' => 'method_not_allowed'));
}

/* ---------- Защита от спам-ботов ---------- */

if (post_value('_honey', 200) !== '' || post_value('website', 200) !== '') {
    // Скрытое поле заполняют только боты. Отвечаем как на успех.
    respond(200, array('ok' => true));
}

/* ---------- Проверка полей ---------- */

$name = post_value('name', 120);
$phone = post_value('phone', 40);
$phoneDigits = preg_replace('/\D+/', '', $phone);
$email = post_value('email', 190);

if ($phone === '' || strlen($phoneDigits) < 10) {
    respond(422, array('ok' => false, 'error' => 'phone'));
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $email = '';
}

if (post_value('consent_required', 5) === '1' && post_value('consent', 10) === '') {
    respond(422, array('ok' => false, 'error' => 'consent'));
}

/* ---------- Ограничение частоты ---------- */

$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
$rateDir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'alfa-holod-forms';

if (!is_dir($rateDir)) {
    @mkdir($rateDir, 0700, true);
}

$rateFile = $rateDir . DIRECTORY_SEPARATOR . hash('sha256', $ip) . '.json';
$now = time();
$hits = array();

if (is_file($rateFile)) {
    $decoded = json_decode((string) @file_get_contents($rateFile), true);
    if (is_array($decoded)) {
        $hits = $decoded;
    }
}

$hits = array_values(array_filter($hits, function ($time) use ($now) {
    return is_numeric($time) && $time > $now - RATE_WINDOW;
}));

if (count($hits) >= RATE_LIMIT) {
    respond(429, array('ok' => false, 'error' => 'rate_limited'));
}

$hits[] = $now;
@file_put_contents($rateFile, json_encode($hits), LOCK_EX);

/* ---------- Письмо ---------- */

$fields = array(
    'name'    => 'Имя',
    'phone'   => 'Телефон',
    'email'   => 'Почта',
    'city'    => 'Город',
    'object'  => 'Тип объекта',
    'volume'  => 'Объём камеры',
    'temp'    => 'Температурный режим',
    'task'    => 'Задача',
    'comment' => 'Комментарий',
    'product' => 'Товар',
    'source'  => 'Форма',
    'page'    => 'Страница'
);

$lines = array('Новая заявка с сайта', '');

foreach ($fields as $key => $label) {
    $max = in_array($key, array('task', 'comment'), true) ? 4000 : 600;
    $value = post_value($key, $max);
    if ($value !== '') {
        $lines[] = $label . ': ' . $value;
    }
}

$known = array_merge(array_keys($fields), array(
    '_honey', 'website', 'consent', 'consent_required', 'ajax', 'submit'
));

foreach ($_POST as $key => $unused) {
    if (!is_string($key) || in_array($key, $known, true)) {
        continue;
    }

    $safeKey = preg_replace('/[^a-zA-Z0-9_.-]/', '', $key);
    $value = post_value($key, 500);

    if ($safeKey !== '' && $value !== '') {
        $lines[] = $safeKey . ': ' . $value;
    }
}

$lines[] = '';
$lines[] = 'IP: ' . $ip;
$lines[] = 'Дата: ' . date('d.m.Y H:i');

$bodyText = implode("\r\n", $lines);
$body = chunk_split(base64_encode($bodyText), 76, "\r\n");

$subjectText = 'Заявка с сайта «Альфа-Холод»';
if ($name !== '') {
    $subjectText .= ': ' . $name;
} elseif ($phone !== '') {
    $subjectText .= ': ' . $phone;
}
$subject = '=?UTF-8?B?' . base64_encode(str_replace(array("\r", "\n"), ' ', $subjectText)) . '?=';

$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
$host = strtolower(preg_replace('/:\d+$/', '', $host));
$host = preg_replace('/[^a-z0-9.-]/', '', $host);
if ($host === '' || strpos($host, '.') === false) {
    $host = 'localhost.localdomain';
}

$from = 'no-reply@' . $host;
$replyTo = $email !== '' ? $email : $MAIL_TO;

$headers = array(
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    'From: =?UTF-8?B?' . base64_encode('Сайт Альфа-Холод') . '?= <' . $from . '>',
    'Reply-To: ' . $replyTo,
    'X-Mailer: PHP/' . phpversion()
);

$headerText = implode("\r\n", $headers);

if (!function_exists('mail')) {
    error_log('Alfa-Holod: mail() is disabled on this hosting');
    respond(503, array('ok' => false, 'error' => 'mail_unavailable'));
}

$sent = @mail($MAIL_TO, $subject, $body, $headerText, '-f' . $from);

if (!$sent) {
    // На некоторых хостингах дополнительный параметр -f запрещён.
    $sent = @mail($MAIL_TO, $subject, $body, $headerText);
}

if (!$sent) {
    error_log('Alfa-Holod: mail() failed, recipient=' . $MAIL_TO);
    respond(500, array('ok' => false, 'error' => 'mail_failed'));
}

respond(200, array('ok' => true));
