import { Module } from '@nestjs/common';
import { GmailModule } from '../gmail/gmail.module';
import { UsersModule } from '../users/users.module';
import { JobPositionsModule } from '../job-positions/job-positions.module';
import { GeminiModule } from '../gemini/gemini.module';
import { PdfParserModule } from '../pdf-parser/pdf-parser.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { EmailMetadataModule } from '../email-metadata/email-metadata.module';
import { CvAnalysisModule } from '../cv-analysis/cv-analysis.module';
import { GmailWebhookController } from './gmail-webhook.controller';
import { GmailWebhookService } from './gmail-webhook.service';

@Module({
  imports: [
    GmailModule,
    UsersModule,
    JobPositionsModule,
    GeminiModule,
    PdfParserModule,
    CandidatesModule,
    EmailMetadataModule,
    CvAnalysisModule,
  ],
  controllers: [GmailWebhookController],
  providers: [GmailWebhookService],
})
export class GmailWebhookModule {}
