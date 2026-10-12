<?php
/**
 * Test Email Script - Run from browser: http://localhost:8000/test_email.php?to=your_email@gmail.com
 * Or run from CLI: php test_email.php your_email@gmail.com
 */

header('Content-Type: text/html; charset=utf-8');

$to = $_GET['to'] ?? ($argv[1] ?? '');
$configFile = __DIR__ . '/email_config.php';
$config = file_exists($configFile) ? require($configFile) : [];

?>
<!DOCTYPE html>
<html>
<head>
    <title>Quick Cart - Email Diagnostic & Test</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1117; color: #e6edf3; padding: 30px 20px; line-height: 1.6; }
        .box { max-width: 600px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 28px; }
        h1 { margin-top: 0; font-size: 22px; color: #fff; }
        input[type="email"] { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #fff; box-sizing: border-box; font-size: 14px; margin: 10px 0; }
        button { background: #7c5cfc; color: #fff; border: 0; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 15px; }
        .ok { background: #163828; color: #3fb950; border: 1px solid #238636; }
        .warn { background: #382415; color: #d29922; border: 1px solid #9e6a03; }
        .log { background: #0d1117; border: 1px solid #30363d; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; margin-top: 15px; }
    </style>
</head>
<body>
<div class="box">
    <h1>Quick Cart Real Email Diagnostic</h1>
    <?php
    $driver = $config['driver'] ?? 'smtp';
    $hasSmtp = !empty($config['smtp']['username']) && !empty($config['smtp']['password']);
    $hasResend = !empty($config['resend']['api_key']);

    if ($driver === 'resend_api' && $hasResend) {
        echo '<div class="status-badge ok">✓ Resend API Configured (' . htmlspecialchars(substr($config['resend']['api_key'], 0, 7) . '...') . ')</div>';
    } elseif ($hasSmtp) {
        echo '<div class="status-badge ok">✓ SMTP Configured (' . htmlspecialchars($config['smtp']['username']) . ')</div>';
    } else {
        echo '<div class="status-badge warn">⚠ Email Service Not Yet Configured in email_config.php</div>';
        echo '<p style="color:#8b949e;font-size:13px">Please open <code>email_config.php</code> and set your Resend API Key or SMTP credentials.</p>';
    }
    ?>

    <form method="GET">
        <label style="font-size:13px;font-weight:600">Send Test OTP to Email:</label>
        <input type="email" name="to" value="<?= htmlspecialchars($to) ?>" placeholder="Enter your real email address (e.g. you@gmail.com)" required>
        <button type="submit">Send Test Email</button>
    </form>

    <?php
    if (!empty($to)) {
        echo '<hr style="border:0;border-top:1px solid #30363d;margin:25px 0 15px">';
        echo '<h3 style="margin-top:0">Sending Result:</h3>';
        
        $code = (string)random_int(100000, 999999);
        $subject = "Quick Cart Test Verification Code: $code";
        $body = "
        <div style='background:#111114;padding:30px;color:#fff;font-family:sans-serif;border-radius:10px;'>
            <h2 style='color:#fff'>Verify your email address</h2>
            <p style='color:#ccc'>Hi Dinesh, thanks for verifying! Use the code below:</p>
            <div style='background:#1e1e24;padding:20px;text-align:center;border-radius:8px;font-size:36px;font-weight:bold;color:#b18cff;letter-spacing:6px;'>$code</div>
            <p style='color:#888;font-size:12px;'>This code expires in 10 minutes.</p>
        </div>";

        if ($driver === 'resend_api') {
            if (!$hasResend) {
                echo "<p style='color:#f85149'>Cannot send: Resend API key is missing in <code>email_config.php</code>.</p>";
            } else {
                $apiKey = $config['resend']['api_key'];
                $from = $config['resend']['from'] ?? 'Quick Cart <onboarding@resend.dev>';
                $ch = curl_init('https://api.resend.com/emails');
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Type: application/json'
                ]);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                    'from' => $from,
                    'to' => [$to],
                    'subject' => $subject,
                    'html' => $body
                ]));
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
                $resp = curl_exec($ch);
                $curlErr = curl_error($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode >= 200 && $httpCode < 300) {
                    echo "<p style='color:#3fb950;font-weight:bold'>✓ Success! Test email with code $code sent to $to via Resend API. Please check your inbox and spam folder.</p>";
                } else {
                    echo "<p style='color:#f85149;font-weight:bold'>✗ Failed (HTTP $httpCode):</p>";
                    $detail = $curlErr ? "cURL Error: $curlErr" : $resp;
                    echo "<div class='log'>" . htmlspecialchars($detail) . "</div>";
                }
            }
        } else {
            if (!$hasSmtp) {
                echo "<p style='color:#f85149'>Cannot send: SMTP credentials are not filled in <code>email_config.php</code>.</p>";
            } else {
                require_once __DIR__ . '/smtp_mailer.php';
                $smtp = $config['smtp'];
                $mailer = new SmtpMailer($smtp['host'], $smtp['port'], $smtp['username'], $smtp['password'], $smtp['from_email'], $smtp['from_name']);
                $res = $mailer->send($to, 'Test User', $subject, $body);

                if ($res['success']) {
                    echo "<p style='color:#3fb950;font-weight:bold'>✓ Success! Test email with code $code sent to $to via SMTP. Please check your inbox and spam folder.</p>";
                } else {
                    echo "<p style='color:#f85149;font-weight:bold'>✗ Failed: " . htmlspecialchars($res['error']) . "</p>";
                    echo "<div class='log'>" . htmlspecialchars($mailer->getLog()) . "</div>";
                }
            }
        }
    }
    ?>
</div>
</body>
</html>
