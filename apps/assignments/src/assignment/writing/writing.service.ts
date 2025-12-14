import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WritingAssignment, WritingAssignmentDocument } from '../schemas/writing-assignment.schema';
import { CreateWritingAssignmentDto } from './dto/create-writing-assignment.dto';
import { UpdateWritingAssignmentDto } from './dto/update-writing-assignment.dto';
import { WritingSubmission, WritingSubmissionDocument } from './schemas/writing-submission.schema';
import { CreateWritingSubmissionDto } from './dto/create-writing-submission.dto';
import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';
import { RabbitService } from '../../rabbit/rabbit.service';

@Injectable()
export class WritingService {
  constructor(
    @InjectModel(WritingAssignment.name)
    private writingAssignmentModel: Model<WritingAssignmentDocument>,
    @InjectModel(WritingSubmission.name)
    private writingSubmissionModel: Model<WritingSubmissionDocument>,
    private rabbitService: RabbitService,
  ) {}

  async createAssignment(dto: CreateWritingAssignmentDto) {
    const created = new this.writingAssignmentModel(dto);
    return created.save();
  }

  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<any> | any[]> {
    if (!pagination) {
      return this.writingAssignmentModel.find().exec();
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 6;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.writingAssignmentModel.find().skip(skip).limit(limit).exec(),
      this.writingAssignmentModel.countDocuments().exec(),
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
    return this.writingAssignmentModel.findOne({ _id: id }).exec();
  }

  async update(id: string, dto: UpdateWritingAssignmentDto) {
    return this.writingAssignmentModel
      .findOneAndUpdate({ _id: id }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.writingAssignmentModel.findOneAndDelete({ _id: id }).exec();
  }

  async submitEssay(dto: CreateWritingSubmissionDto) {
    const assignment = await this.writingAssignmentModel.findOne({ _id: dto.assignment_id }).exec();
    if (!assignment) throw new BadRequestException('assignment_id must reference a writing assignment');

    const created = new this.writingSubmissionModel({
      ...dto,
      status: 'pending',
      score: undefined,
      feedback: undefined,
    } as any);
    const saved = await created.save();

    try {
      await this.rabbitService.send('grade_queue', {
        skill: 'writing',
        submissionId: saved.id,
        assignmentId: dto.assignment_id,
        userId: dto.user_id,
        contentOne: dto.contentOne,
        contentTwo: dto.contentTwo,
      });
    } catch (error) {
      // Best-effort: keep the submission, but mark it failed if we can't queue grading.
      await this.writingSubmissionModel
        .findOneAndUpdate(
          { id: saved.id },
          { status: 'failed' },
          { new: true },
        )
        .exec();
      throw error;
    }

    return saved;
  }

  async updateSubmissionGrade(submissionId: string, score: number | undefined, feedback: string | undefined) {
    return this.writingSubmissionModel
      .findOneAndUpdate(
        { id: submissionId },
        { score, feedback, status: 'graded' },
        { new: true },
      )
      .exec();
  }

  async markSubmissionFailed(submissionId: string) {
    return this.writingSubmissionModel
      .findOneAndUpdate({ id: submissionId }, { status: 'failed' }, { new: true })
      .exec();
  }

  async getSubmission(id: string) {
    return this.writingSubmissionModel.findOne({ id }).exec();
  }

  async getAllSubmissions() {
    return this.writingSubmissionModel.find().exec();
  }

  async getUserSubmissions(userId: string) {
    return this.writingSubmissionModel.find({ user_id: userId }).exec();
  }

  async getAssignmentSubmissions(assignmentId: string) {
    return this.writingSubmissionModel.find({ assignment_id: assignmentId }).exec();
  }
}


