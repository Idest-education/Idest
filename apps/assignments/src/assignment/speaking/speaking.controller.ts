import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, UseInterceptors, UploadedFile, UploadedFiles } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SpeakingService } from './speaking.service';
import { CreateSpeakingAssignmentDto } from './dto/create-speaking-assignment.dto';
import { UpdateSpeakingAssignmentDto } from './dto/update-speaking-assignment.dto';
import { CreateSpeakingResponseDto } from './dto/create-speaking-response.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiTags('speaking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('speaking')
export class SpeakingController {
  constructor(private readonly speakingService: SpeakingService) {}

  @Post('assignments')
  @ApiOperation({ summary: 'Create speaking assignment' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateSpeakingAssignmentDto) {
    const data = await this.speakingService.createAssignment(dto);
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'List speaking assignments' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll() {
    const data = await this.speakingService.findAll();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get speaking assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    const data = await this.speakingService.findOne(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Update speaking assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateSpeakingAssignmentDto) {
    const data = await this.speakingService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Delete speaking assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async remove(@Param('id') id: string) {
    const data = await this.speakingService.remove(id);
    return { status: true, message: 'Deleted', data, statusCode: HttpStatus.OK };
  }

  @Post('responses')
  @ApiOperation({ summary: 'Submit speaking response with audio files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['assignment_id', 'user_id'],
      properties: {
        assignment_id: { type: 'string', description: 'Assignment ID' },
        user_id: { type: 'string', description: 'User ID' },
        id: { type: 'string', description: 'Optional response ID' },
        audioOne: { type: 'string', format: 'binary', description: 'Audio file for Part 1' },
        audioTwo: { type: 'string', format: 'binary', description: 'Audio file for Part 2' },
        audioThree: { type: 'string', format: 'binary', description: 'Audio file for Part 3' },
      },
    },
  })
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'audioOne', maxCount: 1 },
    { name: 'audioTwo', maxCount: 1 },
    { name: 'audioThree', maxCount: 1 },
  ]))
  @ApiResponse({ status: HttpStatus.CREATED })
  async submitResponse(
    @Body() dto: CreateSpeakingResponseDto,
    @UploadedFiles() files: {
      audioOne?: Express.Multer.File[],
      audioTwo?: Express.Multer.File[],
      audioThree?: Express.Multer.File[],
    },
  ) {
    const data = await this.speakingService.submitResponse(dto, files);
    return { status: true, message: 'Submitted', data, statusCode: HttpStatus.CREATED };
  }

  @Get('responses')
  @ApiOperation({ summary: 'Get all speaking responses' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAllResponses() {
    const data = await this.speakingService.getAllResponses();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('responses/user/:userId')
  @ApiOperation({ summary: 'Get user speaking responses' })
  @ApiResponse({ status: HttpStatus.OK })
  async getUserResponses(@Param('userId') userId: string) {
    const data = await this.speakingService.getUserResponses(userId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('responses/assignment/:assignmentId')
  @ApiOperation({ summary: 'Get all responses for a speaking assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAssignmentResponses(@Param('assignmentId') assignmentId: string) {
    const data = await this.speakingService.getAssignmentResponses(assignmentId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('responses/:id')
  @ApiOperation({ summary: 'Get speaking response' })
  @ApiResponse({ status: HttpStatus.OK })
  async getResponse(@Param('id') id: string) {
    const data = await this.speakingService.getResponse(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Post('speech-to-text')
  @ApiOperation({ summary: 'Convert speech to text' })
  @ApiConsumes('multipart/form-data') 
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('audio')) // 'audio' = name of the form field
  @ApiResponse({ status: HttpStatus.OK })
  async speechToText(@UploadedFile() audio: Express.Multer.File) {
    const data = await this.speakingService.speechToText(audio);
    return { status: true, message: 'Converted', data, statusCode: HttpStatus.OK };
  }
}


