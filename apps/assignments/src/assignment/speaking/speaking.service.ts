import { BadRequestException, Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SpeakingAssignment, SpeakingAssignmentDocument } from '../schemas/speaking-assignment.schema';
import { SpeakingResponse, SpeakingResponseDocument } from './schemas/speaking-response.schema';
import { CreateSpeakingResponseDto } from './dto/create-speaking-response.dto';
import { CreateSpeakingAssignmentDto } from './dto/create-speaking-assignment.dto';
import { UpdateSpeakingAssignmentDto } from './dto/update-speaking-assignment.dto';
import { GradeService } from '../../grade/grade.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { concatenateAudioFiles, getExtensionFromMimetype } from '../utils/audio.util';
import { v4 as uuidv4 } from 'uuid';
import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';
import { RabbitService } from '../../rabbit/rabbit.service';

@Injectable()
export class SpeakingService {
  constructor(
    @InjectModel(SpeakingAssignment.name)
    private speakingAssignmentModel: Model<SpeakingAssignmentDocument>,
    @InjectModel(SpeakingResponse.name)
    private speakingResponseModel: Model<SpeakingResponseDocument>,
    @Inject(forwardRef(() => GradeService))
    private gradeService: GradeService,
    private supabaseService: SupabaseService,
    private rabbitService: RabbitService,
  ) {}

  async createAssignment(dto: CreateSpeakingAssignmentDto) {
    const created = new this.speakingAssignmentModel(dto);
    return created.save();
  }

  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<any> | any[]> {
    if (!pagination) {
      return this.speakingAssignmentModel.find().exec();
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 6;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.speakingAssignmentModel.find().skip(skip).limit(limit).exec(),
      this.speakingAssignmentModel.countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string) {
    return this.speakingAssignmentModel.findOne({ _id: id }).exec();
  }

  async update(id: string, dto: UpdateSpeakingAssignmentDto) {
    return this.speakingAssignmentModel
      .findOneAndUpdate({ _id: id }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.speakingAssignmentModel.findOneAndDelete({ _id: id }).exec();
  }

  async submitResponse(
    dto: CreateSpeakingResponseDto,
    files: {
      audioOne?: Express.Multer.File[],
      audioTwo?: Express.Multer.File[],
      audioThree?: Express.Multer.File[],
    },
  ) {
    const assignment = await this.speakingAssignmentModel.findOne({ _id: dto.assignment_id }).exec();
    if (!assignment) throw new BadRequestException('assignment_id must reference a speaking assignment');
    
    const submissionId = dto.id || uuidv4();

    let audioUrl: string | undefined;

    const audioFiles: Express.Multer.File[] = [];
    
    if (files.audioOne?.[0]) audioFiles.push(files.audioOne[0]);
    if (files.audioTwo?.[0]) audioFiles.push(files.audioTwo[0]);
    if (files.audioThree?.[0]) audioFiles.push(files.audioThree[0]);
    
    if (audioFiles.length > 0) {
      console.log(`Concatenating ${audioFiles.length} audio files...`);
      const { buffer, mimetype } = concatenateAudioFiles(audioFiles);
      
      const extension = getExtensionFromMimetype(mimetype);
      const fileName = `${submissionId}.${extension}`;
      
      console.log(`Uploading combined audio to Supabase bucket "audio" as ${fileName}...`);
      try {
        audioUrl = await this.supabaseService.uploadFile(
          'audio',
          fileName,
          buffer,
          mimetype,
        );
        console.log(`Audio uploaded successfully: ${audioUrl}`);
      } catch (error) {
        console.error('Failed to upload audio to Supabase:', error);
        audioUrl = '';
      }
    }

    const payload = {
      ...dto,
      id: submissionId,
      audio_url: audioUrl || '',
      transcriptOne: undefined,
      transcriptTwo: undefined,
      transcriptThree: undefined,
      score: undefined,
      feedback: undefined,
      status: 'pending',
    } as any;
    const created = new this.speakingResponseModel(payload);
    const saved = await created.save();

    try {
      await this.rabbitService.send('grade_queue', {
        skill: 'speaking',
        responseId: submissionId,
        assignmentId: dto.assignment_id,
        userId: dto.user_id,
        audios: {
          audioOne: files.audioOne?.[0]
            ? {
                data: files.audioOne[0].buffer.toString('base64'),
                mimetype: files.audioOne[0].mimetype,
                originalname: files.audioOne[0].originalname,
              }
            : undefined,
          audioTwo: files.audioTwo?.[0]
            ? {
                data: files.audioTwo[0].buffer.toString('base64'),
                mimetype: files.audioTwo[0].mimetype,
                originalname: files.audioTwo[0].originalname,
              }
            : undefined,
          audioThree: files.audioThree?.[0]
            ? {
                data: files.audioThree[0].buffer.toString('base64'),
                mimetype: files.audioThree[0].mimetype,
                originalname: files.audioThree[0].originalname,
              }
            : undefined,
        },
      });
    } catch (error) {
      await this.speakingResponseModel
        .findOneAndUpdate({ id: submissionId }, { status: 'failed' }, { new: true })
        .exec();
      throw error;
    }

    return saved;
  }

  async updateResponseGrade(params: {
    responseId: string;
    transcriptOne?: string;
    transcriptTwo?: string;
    transcriptThree?: string;
    score?: number;
    feedback?: string;
  }) {
    const { responseId, ...update } = params;
    return this.speakingResponseModel
      .findOneAndUpdate(
        { id: responseId },
        { ...update, status: 'graded' },
        { new: true },
      )
      .exec();
  }

  async markResponseFailed(responseId: string) {
    return this.speakingResponseModel
      .findOneAndUpdate({ id: responseId }, { status: 'failed' }, { new: true })
      .exec();
  }

  async getResponse(id: string) {
    return this.speakingResponseModel.findOne({ id }).exec();
  }

  async getAllResponses() {
    return this.speakingResponseModel.find().exec();
  }

  async getUserResponses(userId: string) {
    return this.speakingResponseModel.find({ user_id: userId }).exec();
  }

  async getAssignmentResponses(assignmentId: string) {
    return this.speakingResponseModel.find({ assignment_id: assignmentId }).exec();
  }

  async speechToText(file: Express.Multer.File) {
    return this.gradeService.speechToText(file);
  }
}


