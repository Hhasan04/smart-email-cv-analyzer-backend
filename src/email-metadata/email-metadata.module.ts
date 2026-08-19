import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailMetadata } from './email-metadata.entity';
import { EmailMetadataService } from './email-metadata.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailMetadata])],
  providers: [EmailMetadataService],
  exports: [EmailMetadataService],
})
export class EmailMetadataModule {}
