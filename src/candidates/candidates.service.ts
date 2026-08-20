import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { gmail_v1 } from 'googleapis';
import { Candidate, CandidateStatus } from './candidate.entity';
import { QueryCandidatesDto } from './dto/query-candidates.dto';
import { JobPositionsService } from '../job-positions/job-positions.service';
import { GeminiService } from '../gemini/gemini.service';
import { CvAnalysisService } from '../cv-analysis/cv-analysis.service';
import { UsersService } from '../users/users.service';
import { GmailService } from '../gmail/gmail.service';

export interface UpsertCvSubmission {
  fullName: string;
  email: string;
  jobPositionId: string;
  parsedCvText: string;
  resumeFile: Buffer;
  resumeFileName: string;
}

export interface ResumeFile {
  buffer: Buffer;
  filename: string;
}

export interface PaginatedCandidates {
  data: Candidate[];
  total: number;
  page: number;
  limit: number;
}

export interface BulkRejectResult {
  sent: string[];
  failed: string[];
}

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(Candidate)
    private readonly candidatesRepository: Repository<Candidate>,
    private readonly jobPositionsService: JobPositionsService,
    private readonly geminiService: GeminiService,
    private readonly cvAnalysisService: CvAnalysisService,
    private readonly usersService: UsersService,
    private readonly gmailService: GmailService,
  ) {}

  async upsertFromCvSubmission(
    submission: UpsertCvSubmission,
  ): Promise<Candidate> {
    const existing = await this.candidatesRepository.findOne({
      where: {
        email: submission.email,
        jobPositionId: submission.jobPositionId,
      },
    });

    if (existing) {
      existing.fullName = submission.fullName;
      existing.parsedCvText = submission.parsedCvText;
      existing.resumeFile = submission.resumeFile;
      existing.resumeFileName = submission.resumeFileName;
      return this.candidatesRepository.save(existing);
    }

    const candidate = this.candidatesRepository.create({
      fullName: submission.fullName,
      email: submission.email,
      jobPositionId: submission.jobPositionId,
      parsedCvText: submission.parsedCvText,
      resumeFile: submission.resumeFile,
      resumeFileName: submission.resumeFileName,
    });
    return this.candidatesRepository.save(candidate);
  }

  async getResumeFile(id: string): Promise<ResumeFile | null> {
    const candidate = await this.candidatesRepository
      .createQueryBuilder('candidate')
      .addSelect('candidate.resumeFile')
      .where('candidate.id = :id', { id })
      .getOne();

    if (!candidate?.resumeFile || !candidate.resumeFileName) {
      return null;
    }

    return { buffer: candidate.resumeFile, filename: candidate.resumeFileName };
  }

  async findFiltered(query: QueryCandidatesDto): Promise<PaginatedCandidates> {
    const qb = this.candidatesRepository
      .createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.jobPosition', 'jobPosition')
      .leftJoinAndSelect('candidate.cvAnalyses', 'analysis');

    if (query.jobPositionId) {
      qb.andWhere('candidate.jobPositionId = :jobPositionId', {
        jobPositionId: query.jobPositionId,
      });
    }

    if (query.minScore !== undefined) {
      qb.andWhere('analysis.matchScore >= :minScore', {
        minScore: query.minScore,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(candidate.fullName LIKE :search OR candidate.email LIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    qb.orderBy('candidate.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findByIdOrThrow(id: string): Promise<Candidate> {
    const candidate = await this.candidatesRepository.findOne({
      where: { id },
      relations: { jobPosition: true, cvAnalyses: true, emailMetadata: true },
      order: {
        cvAnalyses: { createdAt: 'DESC' },
        emailMetadata: { createdAt: 'DESC' },
      },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
    return candidate;
  }

  async remove(id: string): Promise<void> {
    const result = await this.candidatesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Candidate not found');
    }
  }

  async updateStatus(id: string, status: CandidateStatus): Promise<Candidate> {
    const candidate = await this.findByIdOrThrow(id);
    candidate.status = status;
    return this.candidatesRepository.save(candidate);
  }

  async reevaluate(
    candidateId: string,
    targetJobPositionId: string,
  ): Promise<Candidate> {
    const source = await this.findByIdOrThrow(candidateId);
    if (!source.parsedCvText) {
      throw new BadRequestException(
        'Candidate has no parsed CV text to re-evaluate.',
      );
    }

    const resume = await this.getResumeFile(candidateId);
    if (!resume) {
      throw new BadRequestException(
        'Candidate has no stored resume file to re-evaluate.',
      );
    }

    const targetJobPosition =
      await this.jobPositionsService.findByIdOrThrow(targetJobPositionId);

    const scoreResult = await this.geminiService.scoreCandidate(
      source.parsedCvText,
      {
        title: targetJobPosition.title,
        description: targetJobPosition.description,
        requiredSkills: targetJobPosition.requiredSkills,
        preferredSkills: targetJobPosition.preferredSkills,
        skillsWeight: targetJobPosition.skillsWeight,
        experienceWeight: targetJobPosition.experienceWeight,
        educationWeight: targetJobPosition.educationWeight,
        customPromptTemplate: targetJobPosition.customPromptTemplate,
      },
    );

    if (!scoreResult) {
      throw new BadRequestException(
        'Gemini could not score this candidate against the target job position. Please try again.',
      );
    }

    const candidate = await this.upsertFromCvSubmission({
      fullName: source.fullName,
      email: source.email,
      jobPositionId: targetJobPositionId,
      parsedCvText: source.parsedCvText,
      resumeFile: resume.buffer,
      resumeFileName: resume.filename,
    });

    await this.cvAnalysisService.create({
      candidateId: candidate.id,
      matchScore: scoreResult.matchScore,
      matchingSkills: scoreResult.matchingSkills,
      missingSkills: scoreResult.missingSkills,
      summaryText: scoreResult.summaryText,
      scoreBreakdown: scoreResult.scoreBreakdown ?? null,
    });

    return this.findByIdOrThrow(candidate.id);
  }

  async sendEmail(
    candidateId: string,
    senderUserId: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const candidate = await this.findByIdOrThrow(candidateId);
    const gmail = await this.buildSenderGmailClient(senderUserId);
    await this.gmailService.sendMessage(gmail, {
      to: candidate.email,
      subject,
      bodyText: body,
    });
  }

  async bulkReject(
    candidateIds: string[],
    senderUserId: string,
    subject: string,
    body: string,
  ): Promise<BulkRejectResult> {
    const gmail = await this.buildSenderGmailClient(senderUserId);
    const result: BulkRejectResult = { sent: [], failed: [] };

    for (const candidateId of candidateIds) {
      try {
        const candidate = await this.findByIdOrThrow(candidateId);
        await this.gmailService.sendMessage(gmail, {
          to: candidate.email,
          subject,
          bodyText: body,
        });
        await this.updateStatus(candidateId, CandidateStatus.REJECTED);
        result.sent.push(candidateId);
      } catch {
        result.failed.push(candidateId);
      }
    }

    return result;
  }

  private async buildSenderGmailClient(
    userId: string,
  ): Promise<gmail_v1.Gmail> {
    const user = await this.usersService.findById(userId);
    if (!user?.googleRefreshToken) {
      throw new BadRequestException(
        'Connect a Gmail account before sending email.',
      );
    }
    return this.gmailService.buildClient(user.googleRefreshToken);
  }
}
