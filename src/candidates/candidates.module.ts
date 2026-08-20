import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidate } from './candidate.entity';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { JobPositionsModule } from '../job-positions/job-positions.module';
import { GeminiModule } from '../gemini/gemini.module';
import { CvAnalysisModule } from '../cv-analysis/cv-analysis.module';
import { UsersModule } from '../users/users.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candidate]),
    JobPositionsModule,
    GeminiModule,
    CvAnalysisModule,
    UsersModule,
    GmailModule,
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
