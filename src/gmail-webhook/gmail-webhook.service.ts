import { Injectable, Logger } from '@nestjs/common';
import type { gmail_v1 } from 'googleapis';
import { GmailService } from '../gmail/gmail.service';
import {
  extractPlainTextBody,
  extractSenderEmail,
  extractSenderName,
  findPdfAttachments,
  getHeader,
  PdfAttachment,
} from '../gmail/gmail-message.util';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { JobPositionsService } from '../job-positions/job-positions.service';
import { GeminiService } from '../gemini/gemini.service';
import { PdfParserService } from '../pdf-parser/pdf-parser.service';
import { CandidatesService } from '../candidates/candidates.service';
import { EmailMetadataService } from '../email-metadata/email-metadata.service';
import { EmailStatus } from '../email-metadata/email-metadata.entity';
import { PubSubPushDto, GmailNotificationData } from './pubsub-push.dto';

@Injectable()
export class GmailWebhookService {
  private readonly logger = new Logger(GmailWebhookService.name);

  constructor(
    private readonly gmailService: GmailService,
    private readonly usersService: UsersService,
    private readonly jobPositionsService: JobPositionsService,
    private readonly geminiService: GeminiService,
    private readonly pdfParserService: PdfParserService,
    private readonly candidatesService: CandidatesService,
    private readonly emailMetadataService: EmailMetadataService,
  ) {}

  async processNotification(dto: PubSubPushDto): Promise<void> {
    const notification = this.decodeNotification(dto.message.data);
    const user = await this.usersService.findByGmailAddress(
      notification.emailAddress,
    );

    if (!user?.googleRefreshToken) {
      this.logger.warn(
        `No linked user found for Gmail address ${notification.emailAddress}`,
      );
      return;
    }

    const newHistoryId = String(notification.historyId);

    if (!user.gmailHistoryId) {
      await this.usersService.saveGmailHistoryId(user.id, newHistoryId);
      return;
    }

    const gmail = this.gmailService.buildClient(user.googleRefreshToken);
    const messageIds = await this.gmailService.listNewMessageIds(
      gmail,
      user.gmailHistoryId,
    );

    for (const messageId of messageIds) {
      try {
        await this.processMessage(gmail, user, messageId);
      } catch (error) {
        this.logger.error(
          `Failed to process Gmail message ${messageId}`,
          error as Error,
        );
      }
    }

    await this.usersService.saveGmailHistoryId(user.id, newHistoryId);
  }

  private decodeNotification(data: string): GmailNotificationData {
    const json = Buffer.from(data, 'base64').toString('utf-8');
    return JSON.parse(json) as GmailNotificationData;
  }

  private async processMessage(
    gmail: gmail_v1.Gmail,
    user: User,
    messageId: string,
  ): Promise<void> {
    const alreadyProcessed =
      await this.emailMetadataService.findByMessageId(messageId);
    if (alreadyProcessed) {
      return;
    }

    const message = await this.gmailService.getMessage(gmail, messageId);
    const pdfAttachments = findPdfAttachments(message);

    if (pdfAttachments.length > 0) {
      await this.handleCvSubmission(gmail, message, pdfAttachments, message);
      return;
    }

    if (message.threadId && message.threadId !== message.id) {
      const threadMessages = await this.gmailService.getThreadMessages(
        gmail,
        message.threadId,
      );
      const cvMessage = threadMessages.find(
        (m) => m.id !== message.id && findPdfAttachments(m).length > 0,
      );

      if (cvMessage) {
        const pdfAttachmentsOnCvMessage = findPdfAttachments(cvMessage);
        await this.handleCvSubmission(
          gmail,
          cvMessage,
          pdfAttachmentsOnCvMessage,
          message,
        );
      }
    }
  }

  private async handleCvSubmission(
    gmail: gmail_v1.Gmail,
    cvMessage: gmail_v1.Schema$Message,
    pdfAttachments: PdfAttachment[],
    classificationSourceMessage: gmail_v1.Schema$Message,
  ): Promise<void> {
    const jobPositions = await this.jobPositionsService.listActive();
    const subject = getHeader(classificationSourceMessage, 'Subject') ?? '';
    const body = extractPlainTextBody(classificationSourceMessage);

    const jobPositionId = await this.geminiService.matchJobPosition(
      jobPositions.map((p) => ({ id: p.id, title: p.title })),
      { subject, body },
    );

    if (!jobPositionId) {
      await this.gmailService.sendReply(
        gmail,
        classificationSourceMessage,
        this.buildClarificationReplyBody(jobPositions.map((p) => p.title)),
      );
      return;
    }

    const fromHeader = getHeader(cvMessage, 'From') ?? '';
    const senderEmail = extractSenderEmail(fromHeader);
    const fullName = extractSenderName(fromHeader) ?? senderEmail;

    const attachmentBuffer = await this.gmailService.downloadAttachment(
      gmail,
      cvMessage.id ?? '',
      pdfAttachments[0].attachmentId,
    );
    const parsedCvText =
      await this.pdfParserService.extractText(attachmentBuffer);

    await this.candidatesService.upsertFromCvSubmission({
      fullName,
      email: senderEmail,
      jobPositionId,
      parsedCvText,
    });

    await this.emailMetadataService.create({
      messageId: cvMessage.id ?? '',
      senderEmail,
      subject: getHeader(cvMessage, 'Subject') ?? '',
      bodyText: extractPlainTextBody(cvMessage),
      receivedAt: cvMessage.internalDate
        ? new Date(Number(cvMessage.internalDate))
        : new Date(),
      status: EmailStatus.PENDING_CV_ANALYSIS,
    });
  }

  private buildClarificationReplyBody(jobTitles: string[]): string {
    const list = jobTitles.map((title) => `- ${title}`).join('\n');
    return [
      "Thanks for reaching out! We couldn't automatically match your email to one of our open positions.",
      '',
      "Could you reply to this email letting us know which role you're applying for? Our current open positions are:",
      '',
      list,
      '',
      "Once we hear back we'll continue processing your application.",
    ].join('\n');
  }
}
