<?php
/**
 * Quick Cart - Real Email Verification Configuration Template
 *
 * To enable real email verification:
 * 1. Copy this file to 'email_config.php'
 * 2. Fill in your SMTP credentials or API key below.
 *
 * OPTION 1: GMAIL SMTP (Recommended & Free)
 * 1. Go to your Google Account -> Security -> 2-Step Verification -> App passwords
 * 2. Generate an App Password for 'Mail' / 'QuickCart' (a 16-character code like "abcd efgh ijkl mnop")
 * 3. Set SMTP username to your Gmail address and password to that 16-character App Password.
 *
 * OPTION 2: RESEND / BREVO (Sendinblue)
 * - Driver: 'resend_api' or 'brevo_api'
 * - Enter your API key below
 */

return [
    // Driver options: 'smtp', 'resend_api', 'brevo_api', or 'php_mail'
    'driver' => 'smtp',

    // SMTP Settings (Default: Gmail)
    'smtp' => [
        'host'       => 'smtp.gmail.com',         // e.g. smtp.gmail.com, smtp-relay.brevo.com
        'port'       => 465,                      // 465 for SSL, 587 for TLS
        'username'   => 'your-email@gmail.com',   // Your Gmail or SMTP username
        'password'   => 'your-16-char-app-pass',  // Your 16-character Gmail App Password
        'from_email' => 'your-email@gmail.com',   // Sender email address
        'from_name'  => 'Quick Cart',             // Sender display name
    ],

    // Optional: Resend REST API (if using driver => 'resend_api')
    'resend' => [
        'api_key'    => 're_xxxxxxxx',
        'from'       => 'Quick Cart <onboarding@resend.dev>',
    ],

    // Optional: Brevo REST API (if using driver => 'brevo_api')
    'brevo' => [
        'api_key'    => '',
        'from_email' => '',
        'from_name'  => 'Quick Cart',
    ]
];
