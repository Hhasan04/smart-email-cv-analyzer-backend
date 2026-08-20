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
import { CvAnalysisService } from '../cv-analysis/cv-analysis.service';
import { PubSubPushDto, GmailNotificationData } from './pubsub-push.dto';

@Injectable()
export class GmailWebhookService {
  private readonly logger = new Logger(GmailWebhookService.name);
  private readonly messagesInFlight = new Set<string>();

  constructor(
    private readonly gmailService: GmailService,
    private readonly usersService: UsersService,
    private readonly jobPositionsService: JobPositionsService,
    private readonly geminiService: GeminiService,
    private readonly pdfParserService: PdfParserService,
    private readonly candidatesService: CandidatesService,
    private readonly emailMetadataService: EmailMetadataService,
    private readonly cvAnalysisService: CvAnalysisService,
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
      this.logger.log(
        `First Pub/Sub notification for ${user.gmailAddress} — recording baseline historyId ${newHistoryId}, no messages processed this round.`,
      );
      await this.usersService.saveGmailHistoryId(user.id, newHistoryId);
      return;
    }

    const gmail = this.gmailService.buildClient(user.googleRefreshToken);
    const messageIds = await this.gmailService.listNewMessageIds(
      gmail,
      user.gmailHistoryId,
    );

    this.logger.log(
      `${messageIds.length} new message(s) for ${user.gmailAddress} since historyId ${user.gmailHistoryId}`,
    );

    for (const messageId of messageIds) {
      try {
        await this.processMessage(gmail, user, messageId);
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to process Gmail message ${messageId}: ${err.message}`,
          err.stack,
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
    if (this.messagesInFlight.has(messageId)) {
      this.logger.log(
        `Message ${messageId} is already being processed — skipping concurrent duplicate.`,
      );
      return;
    }
    this.messagesInFlight.add(messageId);

    try {
      const alreadyProcessed =
        await this.emailMetadataService.findByMessageId(messageId);
      if (alreadyProcessed) {
        return;
      }

      const message = await this.gmailService.getMessage(gmail, messageId);
      const pdfAttachments = findPdfAttachments(message);

      if (pdfAttachments.length > 0) {
        this.logger.log(
          `Message ${messageId} has a PDF attachment — treating as a CV submission.`,
        );
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
          this.logger.log(
            `Message ${messageId} is a reply in a thread with an earlier CV attachment (message ${cvMessage.id}) — treating as a job-position clarification.`,
          );
          const pdfAttachmentsOnCvMessage = findPdfAttachments(cvMessage);
          await this.handleCvSubmission(
            gmail,
            cvMessage,
            pdfAttachmentsOnCvMessage,
            message,
          );
          return;
        }
      }

      this.logger.log(
        `Message ${messageId} has no attachment and no CV in its thread — ignoring.`,
      );
    } finally {
      this.messagesInFlight.delete(messageId);
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

    this.logger.log(
      `Matching against ${jobPositions.length} active job position(s): ${jobPositions.map((p) => p.title).join(', ') || 'none'}`,
    );

    const jobPositionId = await this.geminiService.matchJobPosition(
      jobPositions.map((p) => ({ id: p.id, title: p.title })),
      { subject, body },
    );

    if (!jobPositionId) {
      if (
        await this.alreadyRepliedInThread(gmail, classificationSourceMessage)
      ) {
        this.logger.log(
          'Already sent a clarification reply on this thread — skipping duplicate send.',
        );
        return;
      }

      this.logger.log(
        'Gemini could not match this email to an active job position — sending clarification reply.',
      );
      await this.gmailService.sendReply(
        gmail,
        classificationSourceMessage,
        this.buildClarificationReplyBody(jobPositions.map((p) => p.title)),
      );
      return;
    }

    const jobPosition = jobPositions.find((p) => p.id === jobPositionId);
    if (!jobPosition) {
      return;
    }

    this.logger.log(
      `Matched job position "${jobPosition.title}" — parsing CV and scoring.`,
    );

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

    const candidate = await this.candidatesService.upsertFromCvSubmission({
      fullName,
      email: senderEmail,
      jobPositionId,
      parsedCvText,
      resumeFile: attachmentBuffer,
      resumeFileName: pdfAttachments[0].filename,
    });

    const scoreResult = await this.geminiService.scoreCandidate(parsedCvText, {
      title: jobPosition.title,
      description: jobPosition.description,
      requiredSkills: jobPosition.requiredSkills,
      preferredSkills: jobPosition.preferredSkills,
      skillsWeight: jobPosition.skillsWeight,
      experienceWeight: jobPosition.experienceWeight,
      educationWeight: jobPosition.educationWeight,
      customPromptTemplate: jobPosition.customPromptTemplate,
    });

    if (scoreResult) {
      this.logger.log(
        `Scored candidate ${candidate.id}: ${scoreResult.matchScore}% match.`,
      );
      await this.cvAnalysisService.create({
        candidateId: candidate.id,
        matchScore: scoreResult.matchScore,
        matchingSkills: scoreResult.matchingSkills,
        missingSkills: scoreResult.missingSkills,
        summaryText: scoreResult.summaryText,
        scoreBreakdown: scoreResult.scoreBreakdown ?? null,
      });
    } else {
      this.logger.warn(
        `Gemini scoring failed or returned an unparseable response for candidate ${candidate.id} — saved without a score.`,
      );
    }

    await this.emailMetadataService.create({
      messageId: cvMessage.id ?? '',
      candidateId: candidate.id,
      senderEmail,
      subject: getHeader(cvMessage, 'Subject') ?? '',
      bodyText: extractPlainTextBody(cvMessage),
      receivedAt: cvMessage.internalDate
        ? new Date(Number(cvMessage.internalDate))
        : new Date(),
      status: scoreResult
        ? EmailStatus.PROCESSED
        : EmailStatus.PENDING_CV_ANALYSIS,
    });
  }

  private async alreadyRepliedInThread(
    gmail: gmail_v1.Gmail,
    message: gmail_v1.Schema$Message,
  ): Promise<boolean> {
    if (!message.threadId) {
      return false;
    }
    const threadMessages = await this.gmailService.getThreadMessages(
      gmail,
      message.threadId,
    );
    return threadMessages.some((m) => m.labelIds?.includes('SENT'));
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
