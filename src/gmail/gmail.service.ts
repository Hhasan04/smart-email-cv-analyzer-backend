import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { getHeader } from './gmail-message.util';

@Injectable()
export class GmailService {
  constructor(private readonly configService: ConfigService) {}

  buildClient(refreshToken: string): gmail_v1.Gmail {
    const auth = new google.auth.OAuth2(
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    );
    auth.setCredentials({ refresh_token: refreshToken });
    return google.gmail({ version: 'v1', auth });
  }

  async watch(gmail: gmail_v1.Gmail): Promise<{ historyId: string }> {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: this.configService.getOrThrow<string>('GOOGLE_PUBSUB_TOPIC'),
        labelIds: ['INBOX'],
      },
    });
    return { historyId: response.data.historyId ?? '' };
  }

  async listNewMessageIds(
    gmail: gmail_v1.Gmail,
    startHistoryId: string,
  ): Promise<string[]> {
    const ids = new Set<string>();
    let pageToken: string | undefined;

    do {
      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        pageToken,
      });

      for (const record of response.data.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          if (added.message?.id) {
            ids.add(added.message.id);
          }
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return [...ids];
  }

  async getMessage(
    gmail: gmail_v1.Gmail,
    messageId: string,
  ): Promise<gmail_v1.Schema$Message> {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return response.data;
  }

  async getThreadMessages(
    gmail: gmail_v1.Gmail,
    threadId: string,
  ): Promise<gmail_v1.Schema$Message[]> {
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });
    return response.data.messages ?? [];
  }

  async downloadAttachment(
    gmail: gmail_v1.Gmail,
    messageId: string,
    attachmentId: string,
  ): Promise<Buffer> {
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });
    return Buffer.from(response.data.data ?? '', 'base64url');
  }

  async sendReply(
    gmail: gmail_v1.Gmail,
    originalMessage: gmail_v1.Schema$Message,
    bodyText: string,
  ): Promise<void> {
    const fromHeader = getHeader(originalMessage, 'From') ?? '';
    const subjectHeader = getHeader(originalMessage, 'Subject') ?? '';
    const rfc822MessageId = getHeader(originalMessage, 'Message-ID') ?? '';
    const replySubject = subjectHeader.toLowerCase().startsWith('re:')
      ? subjectHeader
      : `Re: ${subjectHeader}`;

    const headerLines = [
      `To: ${fromHeader}`,
      `Subject: ${replySubject}`,
      rfc822MessageId ? `In-Reply-To: ${rfc822MessageId}` : null,
      rfc822MessageId ? `References: ${rfc822MessageId}` : null,
      'Content-Type: text/plain; charset="UTF-8"',
    ].filter((line): line is string => line !== null);

    const raw = [...headerLines, '', bodyText].join('\r\n');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        threadId: originalMessage.threadId ?? undefined,
        raw: Buffer.from(raw, 'utf-8').toString('base64url'),
      },
    });
  }
}
