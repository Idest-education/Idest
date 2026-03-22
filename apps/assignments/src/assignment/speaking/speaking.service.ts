import { BadRequestException, Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SpeakingAssignment, SpeakingAssignmentDocument } from '../schemas/speaking-assignment.schema';
import { SpeakingSubmission, SpeakingSubmissionDocument } from './schemas/speaking-submission.schema';
import { CreateSpeakingSubmissionDto } from './dto/create-speaking-submission.dto';
import { CreateSpeakingAssignmentDto } from './dto/create-speaking-assignment.dto';
import { UpdateSpeakingAssignmentDto } from './dto/update-speaking-assignment.dto';
import { GradeService } from '../../grade/grade.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { concatenateAudioFiles, getExtensionFromMimetype } from '../utils/audio.util';
import { v4 as uuidv4 } from 'uuid';
import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';
import { RabbitService } from '../../rabbit/rabbit.service';
import { generateUniqueSlug } from '../utils/slug.util';

@Injectable()
export class SpeakingService {
  constructor(
    @InjectModel(SpeakingAssignment.name)
    private speakingAssignmentModel: Model<SpeakingAssignmentDocument>,
    @InjectModel(SpeakingSubmission.name)
    private speakingSubmissionModel: Model<SpeakingSubmissionDocument>,
    @Inject(forwardRef(() => GradeService))
    private gradeService: GradeService,
    private supabaseService: SupabaseService,
    private rabbitService: RabbitService,
  ) {}

  async createAssignment(dto: CreateSpeakingAssignmentDto) {
    const data = {
      ...dto,
      slug: dto.slug ?? (await generateUniqueSlug(dto.title, this.speakingAssignmentModel)),
    } as any;
    const created = new this.speakingAssignmentModel(data);
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
    dto: CreateSpeakingSubmissionDto,
    files: {
      audioOne?: Express.Multer.File[];
      audioTwo?: Express.Multer.File[];
      audioThree?: Express.Multer.File[];
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
      const { buffer, mimetype } = concatenateAudioFiles(audioFiles);
      const extension = getExtensionFromMimetype(mimetype);
      const fileName = `${submissionId}.${extension}`;

      try {
        audioUrl = await this.supabaseService.uploadFile('audio', fileName, buffer, mimetype);
      } catch (error) {
        console.error('Failed to upload audio to Supabase:', error);
        audioUrl = '';
      }
    }

    const payload = {
      _id: submissionId,
      assignment_id: dto.assignment_id,
      user_id: dto.user_id,
      audio_url: audioUrl || '',
      transcripts: [],
      score: undefined,
      feedback: undefined,
      status: 'pending',
    } as any;
    const created = new this.speakingSubmissionModel(payload);
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
      await this.speakingSubmissionModel
        .findOneAndUpdate({ _id: submissionId }, { status: 'failed' }, { new: true })
        .exec();
      throw error;
    }

    return saved;
  }

  async updateResponseGrade(params: {
    responseId: string;
    transcripts?: Array<{ part_number: number; item_id?: string; text?: string }>;
    score?: number;
    feedback?: string;
  }) {
    const { responseId, transcripts, score, feedback } = params;
    return this.speakingSubmissionModel
      .findOneAndUpdate(
        { _id: responseId },
        { transcripts, score, feedback, status: 'graded' },
        { new: true },
      )
      .exec();
  }

  async markResponseFailed(responseId: string) {
    return this.speakingSubmissionModel
      .findOneAndUpdate({ _id: responseId }, { status: 'failed' }, { new: true })
      .exec();
  }

  async getResponse(id: string) {
    return this.speakingSubmissionModel.findOne({ _id: id }).exec();
  }

  async getAllResponses() {
    return this.speakingSubmissionModel.find().exec();
  }

  async getUserResponses(userId: string) {
    return this.speakingSubmissionModel.find({ user_id: userId }).exec();
  }

  async getAssignmentResponses(assignmentId: string) {
    return this.speakingSubmissionModel.find({ assignment_id: assignmentId }).exec();
  }

  async speechToText(file: Express.Multer.File) {
    return this.gradeService.speechToText(file);
  }
}
