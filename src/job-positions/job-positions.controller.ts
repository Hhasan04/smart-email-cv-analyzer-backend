import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { JobPosition } from './job-position.entity';
import { JobPositionsService } from './job-positions.service';
import { CreateJobPositionDto } from './dto/create-job-position.dto';
import { UpdateJobPositionDto } from './dto/update-job-position.dto';

@Controller('job-positions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobPositionsController {
  constructor(private readonly jobPositionsService: JobPositionsService) {}

  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @Get()
  findAll(@Query('isActive') isActive?: string): Promise<JobPosition[]> {
    const filter = isActive === undefined ? undefined : isActive === 'true';
    return this.jobPositionsService.findAll(filter);
  }

  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @Get(':id')
  findOne(@Param('id') id: string): Promise<JobPosition> {
    return this.jobPositionsService.findByIdOrThrow(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateJobPositionDto): Promise<JobPosition> {
    return this.jobPositionsService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJobPositionDto,
  ): Promise<JobPosition> {
    return this.jobPositionsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.jobPositionsService.remove(id);
  }
}
