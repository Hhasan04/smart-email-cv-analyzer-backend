import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidate } from './candidate.entity';
import { CandidatesService } from './candidates.service';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate])],
  providers: [CandidatesService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
