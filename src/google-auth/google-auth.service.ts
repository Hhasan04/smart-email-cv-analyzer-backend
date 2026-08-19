import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GoogleLinkResult {
  refreshToken: string;
  gmailAddress: string;
}

@Injectable()
export class GoogleAuthService {
  constructor(private readonly configService: ConfigService) {}

  buildAuthUrl(state: string): string {
    const client = this.createClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [GMAIL_READONLY_SCOPE],
      state,
    });
  }

  async exchangeCode(code: string): Promise<GoogleLinkResult> {
    const client = this.createClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh token. Revoke prior access at myaccount.google.com/permissions and try again.',
      );
    }

    client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    if (!profile.data.emailAddress) {
      throw new BadRequestException(
        'Could not determine the connected Gmail address.',
      );
    }

    return {
      refreshToken: tokens.refresh_token,
      gmailAddress: profile.data.emailAddress,
    };
  }

  private createClient(): InstanceType<typeof google.auth.OAuth2> {
    return new google.auth.OAuth2(
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    );
  }
}
