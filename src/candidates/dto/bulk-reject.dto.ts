import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class BulkRejectDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  candidateIds: string[];

  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  body: string;
}
