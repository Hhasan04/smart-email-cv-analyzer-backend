import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CVAnalysis } from './cv-analysis.entity';
import { CvAnalysisService } from './cv-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([CVAnalysis])],
  providers: [CvAnalysisService],
  exports: [CvAnalysisService],
})
export class CvAnalysisModule {}
