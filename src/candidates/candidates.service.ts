import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from './candidate.entity';

export interface UpsertCvSubmission {
  fullName: string;
  email: string;
  jobPositionId: string;
  parsedCvText: string;
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
      return this.candidatesRepository.save(existing);
    }

    const candidate = this.candidatesRepository.create({
      fullName: submission.fullName,
      email: submission.email,
      jobPositionId: submission.jobPositionId,
      parsedCvText: submission.parsedCvText,
    });
    return this.candidatesRepository.save(candidate);
  }
}
