import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosition } from './job-position.entity';
import { CreateJobPositionDto } from './dto/create-job-position.dto';
import { UpdateJobPositionDto } from './dto/update-job-position.dto';

@Injectable()
export class JobPositionsService {
  constructor(
    @InjectRepository(JobPosition)
    private readonly jobPositionsRepository: Repository<JobPosition>,
  ) {}

  listActive(): Promise<JobPosition[]> {
    return this.jobPositionsRepository.find({ where: { isActive: true } });
  }

  findAll(isActive?: boolean): Promise<JobPosition[]> {
    return this.jobPositionsRepository.find({
      where: isActive === undefined ? {} : { isActive },
      order: { createdAt: 'DESC' },
    });
  }

  findById(id: string): Promise<JobPosition | null> {
    return this.jobPositionsRepository.findOne({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<JobPosition> {
    const jobPosition = await this.findById(id);
    if (!jobPosition) {
      throw new NotFoundException('Job position not found');
    }
    return jobPosition;
  }

  create(dto: CreateJobPositionDto): Promise<JobPosition> {
    const jobPosition = this.jobPositionsRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });
    return this.jobPositionsRepository.save(jobPosition);
  }

  async update(id: string, dto: UpdateJobPositionDto): Promise<JobPosition> {
    const jobPosition = await this.findByIdOrThrow(id);
    Object.assign(jobPosition, dto);
    return this.jobPositionsRepository.save(jobPosition);
  }

  async remove(id: string): Promise<void> {
    const result = await this.jobPositionsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Job position not found');
    }
  }
}
