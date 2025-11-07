import { ServerClient } from 'postmark';

// Initialize client with token from environment variable
const client = new ServerClient(process.env.POSTMARK_SERVER_TOKEN ?? '');

export interface VerificationEmailInfo {
  user: { email: string };
  url: string;
  token: string;
}

export async function sendVerificationEmail(
  { user, url, token }: VerificationEmailInfo,
  request?: Request,
) {
  // Modify the callback URL to redirect to sign-in page with verified=true
  const urlObj = new URL(url);
  urlObj.searchParams.set('callbackURL', '/sign-in?verified=true');
  const verificationUrl = urlObj.toString();

  await client.sendEmail({
    From: process.env.MAIL_FROM_ADDRESS ?? 'francis@paon.co.ke',
    To: user.email,
    Subject: 'Verify your email address',
    HtmlBody: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Verify Your Email</h2>
          <p>Thank you for signing up! Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0;">
            Verify Email Address
          </a>
          <p>If you didn't create this account, you can safely ignore this email.</p>
        </body>
        </html>
      `,
    TextBody: `Verify your email address by clicking this link: ${verificationUrl}`,
    MessageStream: 'outbound',
  });
}

export async function sendResetPassword(
  { user, url, token }: VerificationEmailInfo,
  request?: Request,
) {
  // Construct frontend URL: baseURL/reset-password/token
  const urlObj = new URL(url);
  const resetUrl = `${urlObj.origin}/reset-password/${token}`;

  await client.sendEmail({
    From: process.env.MAIL_FROM_ADDRESS ?? 'francis@paon.co.ke',
    To: user.email,
    Subject: 'Reset your password',
    HtmlBody: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Reset Your Password</h2>
          <p>You requested to reset your password. Click the link below to continue:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0;">
            Reset Password
          </a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </body>
        </html>
      `,
    TextBody: `Reset your password by clicking this link: ${resetUrl}\n\nThis link will expire in 1 hour.`,
    MessageStream: 'outbound',
  });
}
