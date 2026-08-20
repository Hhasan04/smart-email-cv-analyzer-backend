import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateJobPositionDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  @IsArray()
  @IsString({ each: true })
  preferredSkills: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
