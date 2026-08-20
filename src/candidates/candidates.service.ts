import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from './candidate.entity';
import { QueryCandidatesDto } from './dto/query-candidates.dto';

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

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(Candidate)
    private readonly candidatesRepository: Repository<Candidate>,
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
}
