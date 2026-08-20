import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateJobPositionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsArray()
  @IsString({ each: true })
  requiredSkills!: string[];

  @IsArray()
  @IsString({ each: true })
  preferredSkills!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  skillsWeight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  experienceWeight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  educationWeight?: number;

  @IsOptional()
  @IsString()
  customPromptTemplate?: string;
}
