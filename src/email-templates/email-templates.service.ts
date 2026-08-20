import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate, EmailTemplateType } from './email-template.entity';

@Injectable()
export class EmailTemplatesService implements OnModuleInit {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly emailTemplatesRepository: Repository<EmailTemplate>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.emailTemplatesRepository.count();
    if (count > 0) {
      return;
    }

    await this.emailTemplatesRepository.save([
      this.emailTemplatesRepository.create({
        title: 'Interview Invite / Next Stage',
        type: EmailTemplateType.OUTREACH,
        subject: "You're moving to the next stage — {{jobTitle}}",
        bodyTemplate:
          'Hi {{candidateName}},\n\n' +
          'Thank you for applying for the {{jobTitle}} position. We were impressed with your background and would like to invite you to the next stage of our process.\n\n' +
          "We'll follow up shortly with available times for a conversation.\n\n" +
          'Best regards,\nThe Hiring Team',
      }),
      this.emailTemplatesRepository.create({
        title: 'Candidate Rejection',
        type: EmailTemplateType.REJECTION,
        subject: 'Update on your application — {{jobTitle}}',
        bodyTemplate:
          'Hi {{candidateName}},\n\n' +
          "Thank you for your interest in the {{jobTitle}} position and for taking the time to apply. After careful consideration, we've decided to move forward with other candidates at this time.\n\n" +
          'We appreciate your interest and wish you the best in your job search.\n\n' +
          'Best regards,\nThe Hiring Team',
      }),
    ]);
  }

  findAll(type?: EmailTemplateType): Promise<EmailTemplate[]> {
    return this.emailTemplatesRepository.find({
      where: type ? { type } : {},
      order: { createdAt: 'ASC' },
    });
  }
}
