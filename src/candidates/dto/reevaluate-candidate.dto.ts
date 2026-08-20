import { IsUUID } from 'class-validator';

export class ReevaluateCandidateDto {
  @IsUUID()
  targetJobPositionId: string;
}
