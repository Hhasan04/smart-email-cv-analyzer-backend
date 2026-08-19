import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailMetadata, EmailStatus } from './email-metadata.entity';

export interface CreateEmailMetadata {
  messageId: string;
  senderEmail: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  status: EmailStatus;
}

@Injectable()
export class EmailMetadataService {
  constructor(
    @InjectRepository(EmailMetadata)
    private readonly emailMetadataRepository: Repository<EmailMetadata>,
  ) {}

  findByMessageId(messageId: string): Promise<EmailMetadata | null> {
    return this.emailMetadataRepository.findOne({ where: { messageId } });
  }

  create(data: CreateEmailMetadata): Promise<EmailMetadata> {
    const emailMetadata = this.emailMetadataRepository.create(data);
    return this.emailMetadataRepository.save(emailMetadata);
  }
}
