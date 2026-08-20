import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CVAnalysis } from './cv-analysis.entity';

export interface CreateCvAnalysis {
  candidateId: string;
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  summaryText: string;
  scoreBreakdown?: {
    skillsScore: number;
    experienceScore: number;
    educationScore: number;
  } | null;
}

@Injectable()
export class CvAnalysisService {
  constructor(
    @InjectRepository(CVAnalysis)
    private readonly cvAnalysisRepository: Repository<CVAnalysis>,
  ) {}

  create(data: CreateCvAnalysis): Promise<CVAnalysis> {
    const analysis = this.cvAnalysisRepository.create(data);
    return this.cvAnalysisRepository.save(analysis);
  }
}
