import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { EmailTemplate, EmailTemplateType } from './email-template.entity';
import { EmailTemplatesService } from './email-templates.service';

@Controller('email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RECRUITER)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  findAll(@Query('type') type?: EmailTemplateType): Promise<EmailTemplate[]> {
    return this.emailTemplatesService.findAll(type);
  }
}
