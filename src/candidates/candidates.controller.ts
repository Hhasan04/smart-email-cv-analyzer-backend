import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { Candidate } from './candidate.entity';
import { CandidatesService, PaginatedCandidates } from './candidates.service';
import { QueryCandidatesDto } from './dto/query-candidates.dto';

@Controller('candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RECRUITER)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  findAll(@Query() query: QueryCandidatesDto): Promise<PaginatedCandidates> {
    return this.candidatesService.findFiltered(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Candidate> {
    return this.candidatesService.findByIdOrThrow(id);
  }

  @Get(':id/resume')
  @Header('Content-Type', 'application/pdf')
  async getResume(@Param('id') id: string): Promise<StreamableFile> {
    const resume = await this.candidatesService.getResumeFile(id);
    if (!resume) {
      throw new NotFoundException('No resume file stored for this candidate');
    }

    const safeFilename = resume.filename.replace(/[^\w.\- ]/g, '_');
    return new StreamableFile(resume.buffer, {
      disposition: `inline; filename="${safeFilename}"`,
    });
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.candidatesService.remove(id);
  }
}
