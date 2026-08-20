import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      skillsWeight: dto.skillsWeight ?? 50,
      experienceWeight: dto.experienceWeight ?? 30,
      educationWeight: dto.educationWeight ?? 20,
    });
    this.assertWeightsSumTo100(jobPosition);
    return this.jobPositionsRepository.save(jobPosition);
  }

  async update(id: string, dto: UpdateJobPositionDto): Promise<JobPosition> {
    const jobPosition = await this.findByIdOrThrow(id);
    Object.assign(jobPosition, dto);
    this.assertWeightsSumTo100(jobPosition);
    return this.jobPositionsRepository.save(jobPosition);
  }

  private assertWeightsSumTo100(jobPosition: JobPosition): void {
    const total =
      jobPosition.skillsWeight +
      jobPosition.experienceWeight +
      jobPosition.educationWeight;

    if (total > 100) {
      throw new BadRequestException(
        `Weights total ${total}% — over 100%. Reduce one of skillsWeight/experienceWeight/educationWeight.`,
      );
    }
    if (total < 100) {
      throw new BadRequestException(
        `Weights total ${total}% — under 100%. Increase one of skillsWeight/experienceWeight/educationWeight.`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.jobPositionsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Job position not found');
    }
  }
}
