import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../schemas/assignment.schema';
import { Submission, SubmissionDocument } from '../schemas/submission.schema';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { SubmitAssignmentDto } from '../dto/submit-assignment.dto';
import { generateUniqueSlug } from '../utils/slug.util';
import { gradeAssignment, GradingResult } from '../utils/grading.util';
import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class ReadingService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
  ) {}

  private assertReadingSections(sections: CreateAssignmentDto['sections']) {
    for (const s of sections) {
      if (!s.reading_material) throw new BadRequestException('reading_material is required for reading sections');
      if (s.listening_material) throw new BadRequestException('listening_material is not allowed for reading sections');
    }
  }

  async createAssignment(dto: CreateAssignmentDto) {
    if (dto.skill && dto.skill !== 'reading') throw new BadRequestException('skill must be reading');
    this.assertReadingSections(dto.sections);
    const data = {
      ...dto,
      slug: dto.slug ?? await generateUniqueSlug(dto.title, this.assignmentModel),
      skill: 'reading',
    } as any;
    const created = new this.assignmentModel(data);
    return created.save();
  }

  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<any> | any[]> {
    if (!pagination) {
      return this.assignmentModel.find({ skill: 'reading' }).exec();
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 6;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.assignmentModel.find({ skill: 'reading' }).skip(skip).limit(limit).exec(),
      this.assignmentModel.countDocuments({ skill: 'reading' }).exec(),
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
    return this.assignmentModel.findOne({ _id: id, skill: 'reading' }).exec();
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    if (dto.skill && dto.skill !== 'reading') throw new BadRequestException('skill must be reading');
    if (dto.sections) this.assertReadingSections(dto.sections as any);
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'reading' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'reading' }).exec();
  }

  async gradeSubmission(submission: SubmitAssignmentDto): Promise<Submission> {
    const assignment = await this.assignmentModel
      .findOne({ _id: submission.assignment_id, skill: 'reading' })
      .exec();

    if (!assignment) {
      throw new NotFoundException('Reading assignment not found');
    }

    const gradingResult = gradeAssignment(assignment, submission);

    const submissionData = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      skill: 'reading',
      ...gradingResult,
    };

    const createdSubmission = new this.submissionModel(submissionData);
    return createdSubmission.save();
  }

  async getAllSubmissions() {
    return this.submissionModel.find({skill: 'reading'}).exec();
  }

  async getUserSubmissions(userId: string) {
    return this.submissionModel.find({ skill: 'reading', submitted_by: userId }).exec();
  }

  async getAssignmentSubmissions(assignmentId: string) {
    return this.submissionModel.find({ skill: 'reading', assignment_id: assignmentId }).exec();
  }

  async getSubmission(id: string) {
    const submission = await this.submissionModel
      .findOne({ _id: id, skill: 'reading' })
      .exec();
    
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    
    return submission;
  }
  async debug() {
    const all = await this.submissionModel.find();
    console.log("Total submissions:", all.length);
    console.log("Collection:", this.submissionModel.collection.name);
    console.log("DB name:", this.submissionModel.db.name);
    console.log("Example skill:", all[0]?.skill);
  
    const filtered = await this.submissionModel.find({ skill: 'reading' });
    console.log("Filtered count:", filtered.length);
  
    return { all, filtered };
  }
}
