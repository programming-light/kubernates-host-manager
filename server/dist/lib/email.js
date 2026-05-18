import nodemailer from 'nodemailer';
import log from './logger.js';
let transporter = null;
async function createDevTransporter() {
    try {
        const testAccount = await nodemailer.createTestAccount();
        const transport = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
        });
        log.info(`Ethereal email ready. View at https://ethereal.email/login (${testAccount.user})`);
        return transport;
    }
    catch {
        log.warn('SMTP not configured. OTPs will be logged to console.');
        return null;
    }
}
function createTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpHost || !smtpUser || !smtpPass) {
        log.info('SMTP not configured. Email sending disabled.');
        return null;
    }
    const config = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    };
    log.info(`SMTP configured: ${smtpHost}:${smtpPort}`);
    return nodemailer.createTransport(config);
}
export async function initEmailService() {
    transporter = createTransporter();
    if (!transporter && process.env.NODE_ENV === 'development') {
        transporter = await createDevTransporter();
        if (transporter) {
            log.info('Using Ethereal test email service for development.');
        }
    }
}
export async function sendEmail(options) {
    if (!transporter) {
        log.warn('Email transporter not initialized. Skipping email send.');
        return false;
    }
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"K8s Platform" <noreply@k8splatform.com>',
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]*>/g, ''),
        });
        log.info(`Email sent to ${options.to}: ${info.messageId}`);
        return true;
    }
    catch (error) {
        log.error('Failed to send email:', error);
        return false;
    }
}
export async function sendOTPEmail(to, otp) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your OTP Code</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #f9fafb; border-radius: 8px; padding: 30px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
    .otp-box { background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 15px; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">K8s Platform</div>
    </div>
    
    <h2>Your One-Time Password (OTP)</h2>
    
    <p>Hello,</p>
    
    <p>Your OTP code for authentication is:</p>
    
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    
    <p>This code will expire in <strong>5 minutes</strong>.</p>
    
    <div class="warning">
      <strong>Security Notice:</strong> If you didn't request this code, please ignore this email. Do not share this code with anyone.
    </div>
    
    <p>Best regards,<br>The K8s Platform Team</p>
    
    <div class="footer">
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
    return sendEmail({
        to,
        subject: 'Your K8s Platform OTP Code',
        html,
    });
}
export function isEmailConfigured() {
    return !!transporter;
}
