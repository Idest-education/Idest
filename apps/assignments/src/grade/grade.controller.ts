import { Controller, Post, Body } from '@nestjs/common';
import { GradeService } from './grade.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@ApiTags('grade')  
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('grade')
export class GradeController {
    constructor(private readonly gradeService: GradeService) {}

}
