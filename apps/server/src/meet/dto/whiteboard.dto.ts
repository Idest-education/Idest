import { IsString, IsNotEmpty, IsObject, IsOptional, IsArray } from 'class-validator';

export class WhiteboardUpdateDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsArray()
  elements: any[];

  @IsObject()
  @IsOptional()
  appState: Record<string, any>;
}

export class GetWhiteboardStateDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class WhiteboardStateResponseDto {
  @IsArray()
  elements: any[];

  @IsObject()
  appState: Record<string, any>;
}
