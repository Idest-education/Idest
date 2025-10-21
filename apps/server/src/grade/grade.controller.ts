import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, HttpStatus } from '@nestjs/common';
import { RabbitService } from 'src/rabbit/rabbit.service';
import { SubmitAssignmentDto } from './dto/submitAssignment.dto';
import { CreateWritingSubmissionDto } from './dto/createWritingSubmission.dto';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { CreateSpeakingResponseDto } from './dto/createSpeakingSubmission.dto';

@Controller("grade")
export class GradeController {
  constructor(private readonly rabbitService: RabbitService) {}

  @Post(':skill')
async submitJson(
  @Param('skill') skill: 'reading' | 'listening',
  @Body() body: SubmitAssignmentDto
) {
  await this.rabbitService.send('grade_queue', {
    skill,
    assignmentId: body.assignment_id,
    userId: body.submitted_by,
    sections: body.section_answers,
  });
  return { message: 'Your submission has been queued for grading' };
}
@Post('writing/submissions')
async submitWriting(
  @Body() body: CreateWritingSubmissionDto
) {
  await this.rabbitService.send('grade_queue', {
    skill: 'writing',
    assignmentId: body.assignment_id,
    userId: body.user_id,
    contentOne: body.contentOne,
    contentTwo: body.contentTwo,
  });
  return { message: 'Your submission has been queued for grading' };
}
@Post('speaking/submissions')
@UseInterceptors(FileFieldsInterceptor([
  { name: 'audioOne', maxCount: 1 },
  { name: 'audioTwo', maxCount: 1 },
  { name: 'audioThree', maxCount: 1 },
]))
async submitSpeaking(
  @Body() dto: CreateSpeakingResponseDto,
  @UploadedFiles() files: {
    audioOne?: Express.Multer.File[],
    audioTwo?: Express.Multer.File[],
    audioThree?: Express.Multer.File[],
  },
) {
  const payload = {
    skill: 'speaking',
    assignmentId: dto.assignment_id,
    userId: dto.user_id,
    id: dto.id,
    audios: {
      audioOne: files.audioOne?.[0]?.buffer.toString('base64'),
      audioTwo: files.audioTwo?.[0]?.buffer.toString('base64'),
      audioThree: files.audioThree?.[0]?.buffer.toString('base64'),
    },
  };

  await this.rabbitService.send('grade_queue', payload);

  return {
    message: 'Your submission has been queued for grading',
  };
}
}
