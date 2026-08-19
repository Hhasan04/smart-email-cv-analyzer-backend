import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as mysql2 from 'mysql2';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { JobPosition } from './job-positions/job-position.entity';
import { JobPositionsModule } from './job-positions/job-positions.module';
import { Candidate } from './candidates/candidate.entity';
import { CandidatesModule } from './candidates/candidates.module';
import { EmailMetadata } from './email-metadata/email-metadata.entity';
import { EmailMetadataModule } from './email-metadata/email-metadata.module';
import { CVAnalysis } from './cv-analysis/cv-analysis.entity';
import { GoogleAuthModule } from './google-auth/google-auth.module';
import { GmailModule } from './gmail/gmail.module';
import { GmailWebhookModule } from './gmail-webhook/gmail-webhook.module';
import { PdfParserModule } from './pdf-parser/pdf-parser.module';
import { GeminiModule } from './gemini/gemini.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        driver: mysql2,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
        entities: [User, JobPosition, Candidate, EmailMetadata, CVAnalysis],
        synchronize: true,
      }),
    }),
    AuthModule,
    UsersModule,
    JobPositionsModule,
    CandidatesModule,
    EmailMetadataModule,
    GoogleAuthModule,
    GmailModule,
    GmailWebhookModule,
    PdfParserModule,
    GeminiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
