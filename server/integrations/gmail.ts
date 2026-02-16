import { google } from 'googleapis';
import { randomBytes } from 'crypto';
import { storage } from '../storage';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function generateOAuthState(): string {
  return randomBytes(32).toString('hex');
}

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

export async function exchangeCode(code: string, userId: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  await storage.saveOauthToken({
    userId,
    provider: 'gmail',
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || undefined,
    tokenType: tokens.token_type || 'Bearer',
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scope: tokens.scope || SCOPES.join(' '),
  });

  return tokens;
}

export async function getAccessToken(userId: string): Promise<string | null> {
  const token = await storage.getOauthToken(userId, 'gmail');
  if (!token) return null;

  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    if (!token.refreshToken) return null;

    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: token.refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();

      await storage.saveOauthToken({
        userId,
        provider: 'gmail',
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || token.refreshToken,
        tokenType: credentials.token_type || 'Bearer',
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        scope: token.scope || undefined,
      });

      return credentials.access_token!;
    } catch (error) {
      console.error('Error refreshing Gmail token:', error);
      return null;
    }
  }

  return token.accessToken;
}

export async function isConnected(userId: string): Promise<boolean> {
  const token = await storage.getOauthToken(userId, 'gmail');
  return !!token;
}

export async function disconnect(userId: string): Promise<void> {
  await storage.deleteOauthToken(userId, 'gmail');
}

export async function sendEmail(
  userId: string,
  params: { to: string; subject: string; body: string; cc?: string; bcc?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    return { success: false, error: 'Gmail not connected or token expired. Please reconnect Gmail.' };
  }

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const headers = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
    ];

    if (params.cc) headers.push(`Cc: ${params.cc}`);
    if (params.bcc) headers.push(`Bcc: ${params.bcc}`);

    const emailContent = `${headers.join('\r\n')}\r\n\r\n${params.body}`;
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return { success: true, messageId: result.data.id || undefined };
  } catch (error: any) {
    console.error('Error sending email via Gmail:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
