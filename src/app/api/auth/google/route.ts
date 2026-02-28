import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage'
);

function decodeIdTokenPayload(idToken: string): { sub: string } {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid id_token format');
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(payload, 'base64').toString('utf-8');
  return JSON.parse(json);
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.access_token) {
      return NextResponse.json({ error: 'No access_token received' }, { status: 500 });
    }

    // Prefer id_token (no extra HTTP call); fall back to userinfo endpoint
    let userId: string;
    if (tokens.id_token) {
      userId = decodeIdTokenPayload(tokens.id_token).sub;
    } else {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const info = await res.json() as { sub: string };
      userId = info.sub;
    }

    return NextResponse.json({ userId });
  } catch (error) {
    console.error('Error during authentication:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
