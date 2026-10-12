<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$configFile = __DIR__ . '/email_config.php';
$config = file_exists($configFile) ? require($configFile) : [];

if ($_SERVER['REQUEST_METHOD'] === 'GET' && empty($_GET['action'])) {
    $isConfigured = !empty($config['smtp']['username']) && !empty($config['smtp']['password']);
    echo json_encode([
        'success' => true,
        'status' => 'Verification Service Active',
        'smtp_configured' => $isConfigured,
        'driver' => $config['driver'] ?? 'smtp'
    ]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? ($_GET['action'] ?? 'status');
$logFile = __DIR__ . '/verification_log.json';

// -------------------------------------------------------------
// ACTION: SEND VERIFICATION EMAIL
// -------------------------------------------------------------
if ($action === 'send') {
    $email = trim($input['email'] ?? '');
    $name = trim($input['name'] ?? 'Shopper');
    $type = trim($input['type'] ?? 'signup'); // 'signup' or 'login'

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'A valid email address is required.']);
        exit;
    }

    // Generate secure 6-digit verification code
    $code = (string)random_int(100000, 999999);
    $expiresAt = time() + 600; // 10 minutes

    // Store in verification log
    $entry = [
        'email' => strtolower($email),
        'name' => $name,
        'code' => $code,
        'type' => $type,
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => date('Y-m-d H:i:s', $expiresAt)
    ];

    $logs = [];
    if (file_exists($logFile)) {
        $logs = json_decode(file_get_contents($logFile), true) ?? [];
    }
    array_unshift($logs, $entry);
    $logs = array_slice($logs, 0, 50);
    @file_put_contents($logFile, json_encode($logs, JSON_PRETTY_PRINT));

    // Email Subject & Body
    $subject = $type === 'signup' 
        ? "Verify your email address - Quick Cart" 
        : "Your login verification code - Quick Cart";

    $actionText = $type === 'signup' 
        ? "thanks for signing up! Use the code below to verify your account and complete registration." 
        : "welcome back! Use the code below to verify your account and complete login.";

    // HTML Email matching the dark screenshot template
    $htmlBody = "
    <!DOCTYPE html>
    <html lang='en'>
    <head>
        <meta charset='utf-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>{$subject}</title>
    </head>
    <body style='margin:0;padding:24px 12px;background-color:#0b0c10;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;'>
        <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:440px;margin:0 auto;background-color:#111114;border:1px solid #23232b;border-radius:16px;padding:32px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.8);color:#c4c4d2;'>
            <tr>
                <td>
                    <div style='font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;margin-bottom:12px;'>Quick Cart</div>
                    <div style='height:2px;width:100%;background:#9d80f8;margin-bottom:24px;'></div>
                    <h2 style='font-size:22px;font-weight:700;color:#ffffff;margin:0 0 14px 0;letter-spacing:-0.2px;'>Verify your email address</h2>
                    <p style='font-size:14px;line-height:1.6;color:#c8c8d5;margin:0 0 24px 0;'>
                        Hi <strong style='color:#ffffff;font-weight:700;'>" . htmlspecialchars($name) . "</strong> , " . $actionText . "
                    </p>

                    <div style='background-color:#1c1c22;border:1px solid #282833;border-radius:12px;padding:26px 16px;text-align:center;margin:22px 0;'>
                        <div style='font-size:11px;letter-spacing:2px;color:#8c8d9e;font-weight:600;text-transform:uppercase;margin-bottom:8px;'>YOUR VERIFICATION CODE</div>
                        <div style='font-size:42px;font-weight:800;color:#b18cff;letter-spacing:8px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;line-height:1.15;margin:4px 0;'>" . htmlspecialchars($code) . "</div>
                    </div>

                    <p style='font-size:13px;line-height:1.55;color:#9a9aa8;margin:0;'>
                        This code expires in <strong style='color:#dedee8;'>10 minutes</strong>. If you didn't request this code, you can safely ignore this email.
                    </p>

                    <hr style='border:none;border-top:1px solid #23232c;margin:26px 0 16px;'>

                    <div style='font-size:11.5px;line-height:1.6;color:#6e6f82;'>
                        <div style='color:#7e7f94;margin-bottom:4px;'>&copy; " . date('Y') . " Quick Cart &middot; quickcart.live</div>
                        <div style='color:#5d5e70;'>You're receiving this email regarding your activity on Quick Cart.</div>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    ";

    $driver = $config['driver'] ?? 'smtp';
    $sendResult = ['success' => false, 'error' => 'No mail driver configured'];

    // 1. SMTP Driver (Gmail, Brevo, SendGrid, custom)
    if ($driver === 'smtp') {
        require_once __DIR__ . '/smtp_mailer.php';
        $smtp = $config['smtp'] ?? [];
        $host = $smtp['host'] ?? 'smtp.gmail.com';
        $port = $smtp['port'] ?? 465;
        $username = $smtp['username'] ?? '';
        $password = $smtp['password'] ?? '';
        $fromEmail = $smtp['from_email'] ?: $username;
        $fromName = $smtp['from_name'] ?? 'Quick Cart';

        if (empty($username) || empty($password)) {
            // SMTP not yet filled with user's credentials
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => "SMTP credentials not configured yet! Please open email_config.php and add your Gmail address and 16-character App Password (or SMTP credentials) to send real emails to $email.",
                'config_required' => true
            ]);
            exit;
        }

        $mailer = new SmtpMailer($host, $port, $username, $password, $fromEmail, $fromName);
        $sendResult = $mailer->send($email, $name, $subject, $htmlBody);
    } 
    // 2. Resend REST API Driver
    else if ($driver === 'resend_api') {
        $apiKey = $config['resend']['api_key'] ?? '';
        if (empty($apiKey)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Resend API key missing in email_config.php']);
            exit;
        }
        $from = $config['resend']['from'] ?? 'Quick Cart <onboarding@resend.dev>';
        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'from' => $from,
            'to' => [$email],
            'subject' => $subject,
            'html' => $htmlBody
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $resp = curl_exec($ch);
        $curlErr = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($httpCode >= 200 && $httpCode < 300) {
            $sendResult = ['success' => true, 'message' => 'Email sent via Resend API'];
        } else {
            $errDetail = $curlErr ? "cURL error: $curlErr" : $resp;
            $sendResult = ['success' => false, 'error' => "Resend API error (HTTP $httpCode): $errDetail"];
        }
    }
    // 3. Native PHP mail() fallback
    else if ($driver === 'php_mail') {
        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=utf-8',
            'From: Quick Cart <no-reply@quickcart.live>',
            'X-Mailer: PHP/' . phpversion()
        ];
        $sent = @mail($email, $subject, $htmlBody, implode("\r\n", $headers));
        $sendResult = $sent 
            ? ['success' => true, 'message' => 'Email dispatched via PHP mail()']
            : ['success' => false, 'error' => 'PHP mail() failed. Please configure SMTP in email_config.php.'];
    }

    if ($sendResult['success']) {
        echo json_encode([
            'success' => true,
            'message' => "Verification code sent to $email. Please check your inbox.",
            'expires_in' => 600
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $sendResult['error'] ?? 'Failed to send email'
        ]);
    }
    exit;
}

// -------------------------------------------------------------
// ACTION: VERIFY 6-DIGIT CODE
// -------------------------------------------------------------
if ($action === 'verify') {
    $email = strtolower(trim($input['email'] ?? ''));
    $code = trim($input['code'] ?? '');

    if (!$email || !$code) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Email and code are required.']);
        exit;
    }

    $logs = [];
    if (file_exists($logFile)) {
        $logs = json_decode(file_get_contents($logFile), true) ?? [];
    }

    $matched = false;
    $now = time();
    foreach ($logs as $item) {
        if ($item['email'] === $email && $item['code'] === $code) {
            if (strtotime($item['expires_at']) >= $now) {
                $matched = true;
                break;
            }
        }
    }

    if ($matched) {
        echo json_encode(['success' => true, 'message' => 'Email verified successfully!']);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired verification code.']);
    }
    exit;
}

echo json_encode(['success' => true, 'status' => 'ready']);
