import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../schemas/assignment-v2.schema';
import { Submission, SubmissionDocument } from '../schemas/submission.schema';
import { CreateAssignmentV2Dto } from '../dto/v2/create-assignment-v2.dto';
import { UpdateAssignmentV2Dto } from '../dto/v2/update-assignment-v2.dto';
import { SubmitAssignmentV2Dto } from '../dto/v2/submit-assignment-v2.dto';
import { generateUniqueSlug } from '../utils/slug.util';
import { gradeAssignmentV2, GradingResultV2 } from '../utils/grading-v2.util';
import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class ListeningService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
  ) {}

  private assertListeningSections(sections: CreateAssignmentV2Dto['sections']) {
    for (const s of sections) {
      if ((s as any)?.material?.type !== 'listening') throw new BadRequestException('material.type must be listening for listening sections');
    }
  }

  async createAssignment(dto: CreateAssignmentV2Dto) {
    if (dto.skill && dto.skill !== 'listening') throw new BadRequestException('skill must be listening');
    this.assertListeningSections(dto.sections);
    const data = {
      ...dto,
      slug: dto.slug ?? await generateUniqueSlug(dto.title, this.assignmentModel),
      skill: 'listening',
    } as any;
    const created = new this.assignmentModel(data);
    return created.save();
  }

  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<any> | any[]> {
    if (!pagination) {
      return this.assignmentModel.find({ skill: 'listening' }).exec();
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 6;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.assignmentModel.find({ skill: 'listening' }).skip(skip).limit(limit).exec(),
      this.assignmentModel.countDocuments({ skill: 'listening' }).exec(),
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
    return this.assignmentModel.findOne({ _id: id, skill: 'listening' }).exec();
  }

  async update(id: string, dto: UpdateAssignmentV2Dto) {
    if (dto.skill && dto.skill !== 'listening') throw new BadRequestException('skill must be listening');
    if (dto.sections) this.assertListeningSections(dto.sections as any);
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'listening' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'listening' }).exec();
  }

  async gradeSubmission(submission: SubmitAssignmentV2Dto): Promise<Submission> {
    const assignment = await this.assignmentModel
      .findOne({ _id: submission.assignment_id, skill: 'listening' })
      .exec();

    if (!assignment) {
      throw new NotFoundException('Listening assignment not found');
    }

    const gradingResult = gradeAssignmentV2(assignment as any, submission as any);

    const submissionData = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      skill: 'listening',
      answers_v2: submission.section_answers,
      ...gradingResult,
    };

    const createdSubmission = new this.submissionModel(submissionData);
    return createdSubmission.save();
  }

  async getAllSubmissions() {
    const results = await this.submissionModel.find({ skill: 'listening' }).exec();
    return results || [];
  }

  async getUserSubmissions(userId: string) {
    const results = await this.submissionModel.find({ skill: 'listening', submitted_by: userId }).exec();
    return results || [];
  }

  async getAssignmentSubmissions(assignmentId: string) {
    const results = await this.submissionModel.find({ skill: 'listening', assignment_id: assignmentId }).exec();
    return results || [];
  }

  async getSubmission(id: string) {
    const submission = await this.submissionModel
      .findOne({ _id: id, skill: 'listening' })
      .exec();
    
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    
    return submission;
  }
}


