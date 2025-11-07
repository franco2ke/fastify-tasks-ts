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
  const modifiedUrl = urlObj.toString();

  await client.sendEmail({
    From: process.env.MAIL_FROM_ADDRESS ?? 'francis@paon.co.ke',
    To: user.email,
    Subject: 'Verify your email address',
    HtmlBody: `<strong>Hello</strong> Click the link to verify your email: ${modifiedUrl}.`,
    TextBody: `Click the link to verify your email: ${modifiedUrl}`,
    MessageStream: 'outbound',
  });
}

export async function sendResetPassword(
  { user, url, token }: VerificationEmailInfo,
  request?: Request,
) {
  // Construct frontend URL: baseURL/reset-password/token
  const urlObj = new URL(url);
  const frontendUrl = `${urlObj.origin}/reset-password/${token}`;

  await client.sendEmail({
    From: process.env.MAIL_FROM_ADDRESS ?? 'francis@paon.co.ke',
    To: user.email,
    Subject: 'Reset your password',
    HtmlBody: `<strong>Hello</strong> Click the link to reset your password: ${frontendUrl}.`,
    TextBody: `Click the link to reset your password: ${frontendUrl}`,
    MessageStream: 'outbound',
  });
}
