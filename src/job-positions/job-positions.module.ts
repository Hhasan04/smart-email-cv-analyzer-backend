import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosition } from './job-position.entity';
import { JobPositionsService } from './job-positions.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition])],
  providers: [JobPositionsService],
  exports: [JobPositionsService],
})
export class JobPositionsModule {}
