import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CanvasStateDto } from './canvas-state.dto';

export class OpenCanvasDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class CloseCanvasDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CanvasStateDto)
  canvasState?: CanvasStateDto;
}

export class DrawEventDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsEnum(['draw', 'shape', 'text', 'erase'])
  type: 'draw' | 'shape' | 'text' | 'erase';

  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

export class ClearCanvasDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class GetCanvasStateDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
