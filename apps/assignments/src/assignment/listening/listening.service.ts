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

@Injectable()
export class ListeningService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
  ) {}

  private assertListeningSections(sections: CreateAssignmentDto['sections']) {
    for (const s of sections) {
      if (!s.listening_material) throw new BadRequestException('listening_material is required for listening sections');
      if (s.reading_material) throw new BadRequestException('reading_material is not allowed for listening sections');
    }
  }

  async createAssignment(dto: CreateAssignmentDto) {
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

  async findAll() {
    return this.assignmentModel.find({ skill: 'listening' }).exec();
  }

  async findOne(id: string) {
    return this.assignmentModel.findOne({ _id: id, skill: 'listening' }).exec();
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    if (dto.skill && dto.skill !== 'listening') throw new BadRequestException('skill must be listening');
    if (dto.sections) this.assertListeningSections(dto.sections as any);
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'listening' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'listening' }).exec();
  }

  async gradeSubmission(submission: SubmitAssignmentDto): Promise<Submission> {
    const assignment = await this.assignmentModel
      .findOne({ _id: submission.assignment_id, skill: 'listening' })
      .exec();

    if (!assignment) {
      throw new NotFoundException('Listening assignment not found');
    }

    const gradingResult = gradeAssignment(assignment, submission);

    const submissionData = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      skill: 'listening',
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


