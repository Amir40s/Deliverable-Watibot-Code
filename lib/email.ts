import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

function formatSender(platformName: string, fromValue: string, fallbackEmail: string) {
  const cleaned = fromValue.trim().replace(/^"+|"+$/g, '');
  if (cleaned.includes('<') && cleaned.includes('>')) return cleaned;
  if (!cleaned.includes('@')) {
    return `"${cleaned}" <${fallbackEmail}>`;
  }
  return `"${platformName}" <${cleaned}>`;
}

async function getTransporter() {
  const cfg = await prisma.systemConfig.findFirst({ orderBy: { createdAt: 'asc' } }).catch(() => null);

  const host     = cfg?.smtpHost     || process.env.EMAIL_SERVER_HOST     || 'smtp.gmail.com';
  const port     = cfg?.smtpPort     || parseInt(process.env.EMAIL_SERVER_PORT || '587');
  const user     = cfg?.smtpUser     || process.env.EMAIL_SERVER_USER     || '';
  const pass     = cfg?.smtpPassword || process.env.EMAIL_SERVER_PASSWORD || '';
  const secure   = port === 465;

  return { transporter: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }), user, cfg };
}

/**
 * Send verification email
 * @param to - Recipient email address
 * @param code - 6-digit verification code
 * @param name - User's name
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  name: string
): Promise<boolean> {
  try {
    const { transporter, user, cfg } = await getTransporter();
    if (!user) {
      console.log('📧 Email credentials not configured. Verification code:', code);
      return false;
    }
    const platformName  = cfg?.platformName  || 'Watibot';
    const emailFrom     = cfg?.smtpFrom || cfg?.smtpUser || process.env.EMAIL_FROM || user;
    const officeAddress = cfg?.officeAddress || '';
    const from          = formatSender(platformName, emailFrom, user);
    const mailOptions = {
      from,
      to,
      subject: `Verify Your Email - ${platformName}`,
      html: getVerificationEmailTemplate(name, code, platformName, officeAddress),
      text: `Hi ${name},\n\nYour verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\n${platformName} Team`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
}

/**
 * Send password reset email
 * @param to - Recipient email address
 * @param code - 6-digit reset code
 * @param name - User's name
 */
export async function sendPasswordResetEmail(
  to: string,
  code: string,
  name: string = 'User'
): Promise<boolean> {
  try {
    const { transporter, user, cfg } = await getTransporter();
    if (!user) {
      console.log('📧 Email credentials not configured. Reset code:', code);
      return false;
    }
    const platformName  = cfg?.platformName  || 'Watibot';
    const emailFrom     = cfg?.smtpFrom || cfg?.smtpUser || process.env.EMAIL_FROM || user;
    const officeAddress = cfg?.officeAddress || '';
    const from          = formatSender(platformName, emailFrom, user);
    const mailOptions = {
      from,
      to,
      subject: `Reset Your Password - ${platformName}`,
      html: getPasswordResetEmailTemplate(name, code, platformName, officeAddress, to),
      text: `Hi ${name},\n\nYour 6-digit password reset code is: ${code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\n${platformName} Team`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
}

/**
 * Send welcome email to new users/vendors
 * @param to - Recipient email address
 * @param name - User's name
 */
export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<boolean> {
  try {
    const { transporter, user, cfg } = await getTransporter();
    if (!user) {
      console.log('📧 Email credentials not configured. Welcome email not sent.');
      return false;
    }
    const platformName  = cfg?.platformName  || 'Watibot';
    const emailFrom     = cfg?.smtpFrom || cfg?.smtpUser || process.env.EMAIL_FROM || user;
    const officeAddress = cfg?.officeAddress || '';
    const from          = formatSender(platformName, emailFrom, user);
    const mailOptions = {
      from,
      to,
      subject: `Welcome to ${platformName}!`,
      html: getWelcomeEmailTemplate(name, platformName, officeAddress),
      text: `Hi ${name},\n\nWelcome to ${platformName}! We're thrilled to have you on board. Login to your dashboard to get started.\n\nBest regards,\n${platformName} Team`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
}

export async function sendGlobalBackupEmail({
  to,
  filename,
  backupBody,
  summary,
  createdAt,
}: {
  to: string;
  filename: string;
  backupBody: string;
  summary: {
    tableCount: number;
    rowCount: number;
    mediaFileCount: number;
    mediaBytes: number;
  };
  createdAt: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { transporter, user, cfg } = await getTransporter();
    if (!user) {
      console.log('📧 Email credentials not configured. Global backup email not sent.');
      return { success: false, error: 'Email credentials are not configured.' };
    }

    const platformName = cfg?.platformName || 'Watibot';
    const emailFrom = cfg?.smtpFrom || cfg?.smtpUser || process.env.EMAIL_FROM || user;
    const from = formatSender(platformName, emailFrom, user);
    const createdDate = new Date(createdAt);
    const formattedDate = Number.isNaN(createdDate.getTime())
      ? createdAt
      : createdDate.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

    const mailOptions = {
      from,
      to,
      subject: `Daily Global Backup - ${platformName}`,
      html: getBaseEmailTemplate(`
        <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px; font-weight: 800;">Daily Global Backup</h2>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">
          Your automatic global backup was securely generated at <strong style="color: #0f172a;">${formattedDate}</strong>.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 12px 0; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Backup Summary</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #475569;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Database Tables:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-weight: 600;">${summary.tableCount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Total Rows:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-weight: 600;">${summary.rowCount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Media Files:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-weight: 600;">${summary.mediaFileCount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Media Size:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${(summary.mediaBytes / 1024 / 1024).toFixed(2)} MB</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #64748b; line-height: 1.6; margin: 0; font-size: 14px;">
          The backup JSON file is securely attached to this email. Please store it safely.
        </p>
      `, platformName, cfg?.officeAddress || '', 'Daily Global Backup'),
      text: [
        'Daily Global Backup',
        `Generated at: ${formattedDate}`,
        `Tables: ${summary.tableCount}`,
        `Rows: ${summary.rowCount}`,
        `Media files: ${summary.mediaFileCount}`,
        `Media size: ${summary.mediaBytes} bytes`,
        'The backup JSON file is attached to this email.',
      ].join('\n'),
      attachments: [
        {
          filename,
          content: Buffer.from(backupBody, 'utf8'),
          contentType: 'application/json',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Global backup email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending global backup email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

/**
 * Base email HTML wrapper for professional, premium styling.
 */
function getBaseEmailTemplate(
  contentHtml: string,
  platformName: string,
  officeAddress: string,
  title: string = "Notification"
): string {
  // Always use the live production URL for the logo so it renders correctly 
  // in email clients (like Gmail) which use external image proxies, 
  // even if the app is being tested on localhost.
  const logoUrl = 'https://app.watibot.pro/logo11122.png';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.04); border: 1px solid #f1f5f9;">
              
              <!-- Premium Header -->
              <tr>
                <td align="center" style="padding: 40px 40px 30px 40px; border-bottom: 1px solid #f8fafc;">
                  <img src="${logoUrl}" alt="${platformName}" width="160" style="display: block; margin: 0 auto 16px auto;" />
                  <p style="color: #64748b; font-size: 13px; font-weight: 600; margin: 0; letter-spacing: 0.5px; text-transform: uppercase;">
                    WhatsApp Enterprise CRM
                  </p>
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="padding: 40px;">
                  ${contentHtml}
                </td>
              </tr>
              
              <!-- Minimal Footer -->
              <tr>
                <td style="background-color: #fcfcfd; padding: 32px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0 0 12px 0; font-weight: 500;">
                    © ${new Date().getFullYear()} ${platformName}. All rights reserved.
                  </p>
                  ${officeAddress ? `<p style="color: #94a3b8; font-size: 12px; margin: 0 0 12px 0; line-height: 1.5;">${officeAddress.replace(/\\n/g, '<br>')}</p>` : ''}
                  <p style="color: #cbd5e1; font-size: 11px; margin: 0;">
                    This is an automated message. Please do not reply directly to this email.
                  </p>
                </td>
              </tr>
              
            </table>
            
            <!-- Optional Below-Card Text -->
            <table width="600" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding: 24px 0;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Powered by <strong style="color: #64748b;">${platformName}</strong>
                  </p>
                </td>
              </tr>
            </table>
            
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * HTML template for verification email
 */
function getVerificationEmailTemplate(name: string, code: string, platformName: string, officeAddress: string): string {
  const recipientName = name && name.trim() ? name : 'there';
  const content = `
    <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px; font-weight: 800; tracking-tight;">Hi ${recipientName},</h2>
    <p style="color: #475569; line-height: 1.6; margin: 0 0 28px 0; font-size: 15px;">
      Thank you for signing up with <strong>${platformName}</strong>! To securely complete your registration, please enter the 6-digit verification code below:
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
      <tr>
        <td align="center">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px 36px; display: inline-block; width: 100%; max-width: 420px; box-sizing: border-box;">
            <p style="margin: 0 0 10px 0; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
            <div style="margin: 0; color: #00a884; font-size: 40px; letter-spacing: 14px; font-weight: 800; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-indent: 14px;">${code}</div>
          </div>
        </td>
      </tr>
    </table>

    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px 18px; margin-bottom: 28px; text-align: left;">
      <p style="margin: 0; color: #b45309; font-size: 13px; line-height: 1.5; font-weight: 600;">
        🔒 <strong>Security Warning:</strong> Never share this verification code with anyone. WatiBot representatives will never ask for your code.
      </p>
    </div>
    
    <p style="color: #64748b; line-height: 1.6; margin: 0; font-size: 13px; text-align: center;">
      This code will automatically expire in <strong style="color: #0f172a;">10 minutes</strong>.<br>
      If you did not request this verification, you can safely ignore this email.
    </p>
  `;
  return getBaseEmailTemplate(content, platformName, officeAddress, "Verify Your Email");
}

/**
 * HTML template for password reset email
 */
function getPasswordResetEmailTemplate(name: string, code: string, platformName: string, officeAddress: string, toEmail: string = ''): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.watibot.io';
  const resetUrl = `${baseUrl}/reset-password?identifier=${encodeURIComponent(toEmail)}&code=${encodeURIComponent(code)}`;

  const content = `
    <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px; font-weight: 800;">Hi ${name},</h2>
    <p style="color: #475569; line-height: 1.6; margin: 0 0 32px 0; font-size: 16px;">
      We received a request to securely reset the password for your ${platformName} account. Use the 6-digit recovery code below in your mobile app:
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px 40px; display: inline-block;">
            <p style="margin: 0 0 12px 0; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Your Password Reset Code</p>
            <h1 style="margin: 0; color: #0d9488; font-size: 42px; letter-spacing: 12px; font-weight: 800; padding-left: 12px;">${code}</h1>
          </div>
        </td>
      </tr>
      ${toEmail ? `
      <tr>
        <td align="center" style="padding-top: 24px;">
          <a href="${resetUrl}" style="background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 99px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);">Reset Password Directly</a>
        </td>
      </tr>` : ''}
    </table>
    
    <p style="color: #64748b; line-height: 1.6; margin: 32px 0 0 0; font-size: 14px; text-align: center;">
      This code will automatically expire in <strong style="color: #0f172a;">10 minutes</strong>.<br>If you didn't request a password reset, you can safely ignore this email.
    </p>
  `;
  return getBaseEmailTemplate(content, platformName, officeAddress, "Reset Your Password");
}

/**
 * HTML template for welcome email
 */
function getWelcomeEmailTemplate(name: string, platformName: string, officeAddress: string): string {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login`;
  const content = `
    <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px; font-weight: 800;">Welcome, ${name}! 🎉</h2>
    <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
      We're absolutely thrilled to have you on board. ${platformName} is your premier, all-in-one platform for enterprise WhatsApp marketing, automated customer support, and seamless CRM integrations.
    </p>
    
    <p style="color: #475569; line-height: 1.6; margin: 0 0 32px 0; font-size: 16px;">
      You're all set! You can now securely log into your dashboard to configure your workspace and start engaging with your customers.
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 10px 0;">
          <a href="${loginUrl}" style="background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 99px; font-size: 16px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);">Go to Dashboard</a>
        </td>
      </tr>
    </table>
  `;
  return getBaseEmailTemplate(content, platformName, officeAddress, `Welcome to ${platformName}`);
}

/**
 * Send 2FA Verification Email
 */
export async function sendTwoFactorEmail(
  to: string,
  code: string,
  name: string = 'User'
): Promise<boolean> {
  try {
    const { transporter, user, cfg } = await getTransporter();
    if (!user) {
      console.log('📧 Email credentials not configured. 2FA code:', code);
      return false;
    }
    const platformName  = cfg?.platformName  || 'Watibot';
    const emailFrom     = cfg?.smtpFrom || cfg?.smtpUser || process.env.EMAIL_FROM || user;
    const officeAddress = cfg?.officeAddress || '';
    const from          = formatSender(platformName, emailFrom, user);
    const mailOptions = {
      from,
      to,
      subject: `Your Login Verification Code: ${code} - ${platformName}`,
      html: getTwoFactorEmailTemplate(name, code, platformName, officeAddress),
      text: `Hi ${name},\n\nYour two-factor authentication verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\n${platformName} Team`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ 2FA verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending 2FA verification email:', error);
    return false;
  }
}

function getTwoFactorEmailTemplate(name: string, code: string, platformName: string, officeAddress: string): string {
  const content = `
    <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 22px; font-weight: 800; text-align: center;">Two-Factor Authentication Code</h2>
    <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px; text-align: center;">
      Hi <strong>${name}</strong>, a login attempt to your ${platformName} account requires two-factor verification. Please enter the 6-digit code below to complete your login:
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 16px; padding: 20px 36px; display: inline-block;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #16a34a; font-family: 'Courier New', monospace;">${code}</span>
          </div>
        </td>
      </tr>
    </table>
    
    <p style="color: #64748b; line-height: 1.6; margin: 24px 0 0 0; font-size: 13.5px; text-align: center;">
      This security code will expire in <strong style="color: #0f172a;">10 minutes</strong>.<br>If you did not initiate this login, please change your password immediately.
    </p>
  `;
  return getBaseEmailTemplate(content, platformName, officeAddress, "Two-Factor Verification");
}

