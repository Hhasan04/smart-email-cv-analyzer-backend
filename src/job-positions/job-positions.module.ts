import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosition } from './job-position.entity';
import { JobPositionsService } from './job-positions.service';
import { JobPositionsController } from './job-positions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition])],
  controllers: [JobPositionsController],
  providers: [JobPositionsService],
  exports: [JobPositionsService],
})
export class JobPositionsModule {}
