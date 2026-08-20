import { IsEnum } from 'class-validator';
import { CandidateStatus } from '../candidate.entity';

export class UpdateCandidateStatusDto {
  @IsEnum(CandidateStatus)
  status: CandidateStatus;
}
