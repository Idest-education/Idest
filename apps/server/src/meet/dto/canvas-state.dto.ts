import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  Matches,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  IsEnum,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CanvasOperationDto {
  @IsEnum(['draw', 'shape', 'text', 'erase'])
  type: 'draw' | 'shape' | 'text' | 'erase';

  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;

  @IsString()
  @IsDateString()
  timestamp: string;
}

export class CanvasMetadataDto {
  @IsNumber()
  @Min(100)
  @Max(10000)
  width: number;

  @IsNumber()
  @Min(100)
  @Max(10000)
  height: number;

  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'backgroundColor must be a valid hex color',
  })
  backgroundColor: string;
}

export class CanvasStateDto {
  @IsArray()
  @ArrayMaxSize(1000, {
    message: 'Operations array cannot exceed 1000 items',
  })
  @ValidateNested({ each: true })
  @Type(() => CanvasOperationDto)
  operations: CanvasOperationDto[];

  @ValidateNested()
  @Type(() => CanvasMetadataDto)
  metadata: CanvasMetadataDto;
}

