import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosition } from './job-position.entity';

@Injectable()
export class JobPositionsService {
  constructor(
    @InjectRepository(JobPosition)
    private readonly jobPositionsRepository: Repository<JobPosition>,
  ) {}

  listActive(): Promise<JobPosition[]> {
    return this.jobPositionsRepository.find({ where: { isActive: true } });
  }

  findById(id: string): Promise<JobPosition | null> {
    return this.jobPositionsRepository.findOne({ where: { id } });
  }
}
