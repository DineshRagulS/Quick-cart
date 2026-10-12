<?php
/**
 * Lightweight Zero-Dependency SMTP Mailer for PHP 8.x
 * Supports SSL (port 465) and STARTTLS (port 587)
 */
class SmtpMailer {
    private $host;
    private $port;
    private $username;
    private $password;
    private $fromEmail;
    private $fromName;
    private $timeout = 15;
    private $debug = false;
    private $lastLog = [];

    public function __construct($host, $port, $username, $password, $fromEmail, $fromName = 'Quick Cart') {
        $this->host = $host;
        $this->port = (int)$port;
        $this->username = $username;
        $this->password = $password;
        $this->fromEmail = $fromEmail ?: $username;
        $this->fromName = $fromName;
    }

    public function setDebug($debug) {
        $this->debug = $debug;
    }

    public function getLog() {
        return implode("\n", $this->lastLog);
    }

    private function log($msg) {
        $this->lastLog[] = $msg;
    }

    public function send($toEmail, $toName, $subject, $htmlBody) {
        $this->lastLog = [];
        $isSSL = ($this->port === 465);
        $protocol = $isSSL ? 'ssl://' : '';
        
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        $socket = @stream_socket_client(
            $protocol . $this->host . ':' . $this->port,
            $errno,
            $errstr,
            $this->timeout,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if (!$socket) {
            $this->log("Connect failed: $errstr ($errno)");
            return ['success' => false, 'error' => "Cannot connect to SMTP server {$this->host}:{$this->port} ($errstr)"];
        }

        stream_set_timeout($socket, $this->timeout);

        $greeting = $this->readResponse($socket);
        if (substr($greeting, 0, 3) !== '220') {
            fclose($socket);
            return ['success' => false, 'error' => "SMTP greeting error: $greeting"];
        }

        // Send EHLO
        $this->sendCommand($socket, "EHLO " . gethostname());
        $ehloResp = $this->readResponse($socket);

        // If port 587, initiate STARTTLS
        if ($this->port === 587) {
            $this->sendCommand($socket, "STARTTLS");
            $tlsResp = $this->readResponse($socket);
            if (substr($tlsResp, 0, 3) !== '220') {
                fclose($socket);
                return ['success' => false, 'error' => "STARTTLS failed: $tlsResp"];
            }

            // Encrypt connection
            $crypto = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if (!$crypto) {
                fclose($socket);
                return ['success' => false, 'error' => "Failed to establish TLS encryption with SMTP server."];
            }

            // Resend EHLO after TLS
            $this->sendCommand($socket, "EHLO " . gethostname());
            $this->readResponse($socket);
        }

        // Authenticate
        if (!empty($this->username) && !empty($this->password)) {
            $this->sendCommand($socket, "AUTH LOGIN");
            $authResp = $this->readResponse($socket);
            if (substr($authResp, 0, 3) !== '334') {
                fclose($socket);
                return ['success' => false, 'error' => "AUTH LOGIN not accepted: $authResp"];
            }

            $this->sendCommand($socket, base64_encode($this->username));
            $uResp = $this->readResponse($socket);
            if (substr($uResp, 0, 3) !== '334') {
                fclose($socket);
                return ['success' => false, 'error' => "Username rejected: $uResp"];
            }

            $this->sendCommand($socket, base64_encode($this->password));
            $pResp = $this->readResponse($socket);
            if (substr($pResp, 0, 3) !== '235') {
                fclose($socket);
                return ['success' => false, 'error' => "Authentication failed. Please verify your SMTP email/app password. Server returned: $pResp"];
            }
        }

        // MAIL FROM
        $this->sendCommand($socket, "MAIL FROM:<{$this->fromEmail}>");
        $fromResp = $this->readResponse($socket);
        if (substr($fromResp, 0, 3) !== '250') {
            fclose($socket);
            return ['success' => false, 'error' => "MAIL FROM rejected: $fromResp"];
        }

        // RCPT TO
        $this->sendCommand($socket, "RCPT TO:<$toEmail>");
        $toResp = $this->readResponse($socket);
        if (substr($toResp, 0, 3) !== '250' && substr($toResp, 0, 3) !== '251') {
            fclose($socket);
            return ['success' => false, 'error' => "Recipient rejected ($toEmail): $toResp"];
        }

        // DATA
        $this->sendCommand($socket, "DATA");
        $dataResp = $this->readResponse($socket);
        if (substr($dataResp, 0, 3) !== '354') {
            fclose($socket);
            return ['success' => false, 'error' => "DATA command rejected: $dataResp"];
        }

        // Construct MIME message
        $boundary = "b_" . md5(uniqid(time()));
        $encodedFromName = '=?UTF-8?B?' . base64_encode($this->fromName) . '?=';
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedToName = !empty($toName) ? '=?UTF-8?B?' . base64_encode($toName) . '?=' : '';

        $headers = [
            "Date: " . date('r'),
            "From: {$encodedFromName} <{$this->fromEmail}>",
            "To: " . ($encodedToName ? "{$encodedToName} <{$toEmail}>" : "<{$toEmail}>"),
            "Subject: {$encodedSubject}",
            "MIME-Version: 1.0",
            "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
            "X-Mailer: QuickCart-PHP-Mailer/1.0"
        ];

        $message = implode("\r\n", $headers) . "\r\n\r\n";
        $message .= "--{$boundary}\r\n";
        $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode(strip_tags($htmlBody))) . "\r\n";
        $message .= "--{$boundary}\r\n";
        $message .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode($htmlBody)) . "\r\n";
        $message .= "--{$boundary}--\r\n";
        $message .= ".\r\n";

        fwrite($socket, $message);
        $sendResp = $this->readResponse($socket);

        $this->sendCommand($socket, "QUIT");
        fclose($socket);

        if (substr($sendResp, 0, 3) === '250') {
            return ['success' => true, 'message' => 'Email sent successfully via SMTP'];
        } else {
            return ['success' => false, 'error' => "Message rejected by SMTP server: $sendResp"];
        }
    }

    private function sendCommand($socket, $cmd) {
        $this->log("> " . (strpos($cmd, 'AUTH') === 0 ? 'AUTH ...' : $cmd));
        fwrite($socket, $cmd . "\r\n");
    }

    private function readResponse($socket) {
        $response = "";
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            $this->log("< " . trim($line));
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return trim($response);
    }
}
