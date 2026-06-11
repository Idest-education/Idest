import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtendTimerDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  extraSeconds: number;
}
