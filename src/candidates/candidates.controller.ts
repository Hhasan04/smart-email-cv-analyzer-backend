import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Candidate } from './candidate.entity';
import {
  BulkRejectResult,
  CandidatesService,
  PaginatedCandidates,
} from './candidates.service';
import { QueryCandidatesDto } from './dto/query-candidates.dto';
import { ReevaluateCandidateDto } from './dto/reevaluate-candidate.dto';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto';
import { SendCandidateEmailDto } from './dto/send-candidate-email.dto';
import { BulkRejectDto } from './dto/bulk-reject.dto';

@Controller('candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RECRUITER)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  findAll(@Query() query: QueryCandidatesDto): Promise<PaginatedCandidates> {
    return this.candidatesService.findFiltered(query);
  }

  @Post('bulk-reject')
  bulkReject(
    @Req() req: Request,
    @Body() dto: BulkRejectDto,
  ): Promise<BulkRejectResult> {
    const user = req.user as AuthenticatedUser;
    return this.candidatesService.bulkReject(
      dto.candidateIds,
      user.id,
      dto.subject,
      dto.body,
    );
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

  @Post(':id/reevaluate')
  reevaluate(
    @Param('id') id: string,
    @Body() dto: ReevaluateCandidateDto,
  ): Promise<Candidate> {
    return this.candidatesService.reevaluate(id, dto.targetJobPositionId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCandidateStatusDto,
  ): Promise<Candidate> {
    return this.candidatesService.updateStatus(id, dto.status);
  }

  @Post(':id/send-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendEmail(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: SendCandidateEmailDto,
  ): Promise<void> {
    const user = req.user as AuthenticatedUser;
    return this.candidatesService.sendEmail(id, user.id, dto.subject, dto.body);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.candidatesService.remove(id);
  }
}
