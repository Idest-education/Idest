import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ListeningAssignment, ListeningAssignmentDocument } from '../schemas/listening-assignment.schema';
import { ListeningSubmission, ListeningSubmissionDocument } from '../schemas/listening-submission.schema';
import { CreateListeningAssignmentDto } from './dto/create-listening-assignment.dto';
import { UpdateObjectiveAssignmentDto } from '../dto/objective/update-objective-assignment.dto';
import { SubmitObjectiveAssignmentDto } from '../dto/objective/submit-objective.dto';
import { generateUniqueSlug } from '../utils/slug.util';
import { gradeObjectiveAssignment } from '../utils/grading-objective.util';
import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class ListeningService {
  constructor(
    @InjectModel(ListeningAssignment.name)
    private listeningAssignmentModel: Model<ListeningAssignmentDocument>,
    @InjectModel(ListeningSubmission.name)
    private listeningSubmissionModel: Model<ListeningSubmissionDocument>,
  ) {}

  private assertListeningSections(sections: CreateListeningAssignmentDto['sections']) {
    for (const s of sections) {
      if ((s as any)?.material?.type !== 'listening') {
        throw new BadRequestException('material.type must be listening for listening sections');
      }
    }
  }

  async createAssignment(dto: CreateListeningAssignmentDto) {
    this.assertListeningSections(dto.sections);
    const data = {
      ...dto,
      slug: dto.slug ?? (await generateUniqueSlug(dto.title, this.listeningAssignmentModel)),
    } as any;
    const created = new this.listeningAssignmentModel(data);
    return created.save();
  }

  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<any> | any[]> {
    if (!pagination) {
      return this.listeningAssignmentModel.find().exec();
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 6;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.listeningAssignmentModel.find().skip(skip).limit(limit).exec(),
      this.listeningAssignmentModel.countDocuments().exec(),
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
    const doc: any = await this.listeningAssignmentModel.findOne({ _id: id }).lean().exec();
    if (!doc) return doc;
    for (const section of doc.sections ?? []) {
      for (const group of section.question_groups ?? []) {
        for (const q of group.questions ?? []) {
          delete q.answer_key;
        }
      }
    }
    return doc;
  }

  async update(id: string, dto: UpdateObjectiveAssignmentDto) {
    if (dto.sections) this.assertListeningSections(dto.sections as any);
    return this.listeningAssignmentModel
      .findOneAndUpdate({ _id: id }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.listeningAssignmentModel.findOneAndDelete({ _id: id }).exec();
  }

  async gradeSubmission(submission: SubmitObjectiveAssignmentDto): Promise<ListeningSubmission> {
    const assignment = await this.listeningAssignmentModel.findOne({ _id: submission.assignment_id }).exec();

    if (!assignment) {
      throw new NotFoundException('Listening assignment not found');
    }

    const gradingResult = gradeObjectiveAssignment(assignment as any, submission as any);

    const submissionData = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      answers: { section_answers: submission.section_answers },
      ...gradingResult,
    };

    const createdSubmission = new this.listeningSubmissionModel(submissionData);
    return createdSubmission.save();
  }

  async getAllSubmissions() {
    return this.listeningSubmissionModel.find().exec();
  }

  async getUserSubmissions(userId: string) {
    return this.listeningSubmissionModel.find({ submitted_by: userId }).exec();
  }

  async getAssignmentSubmissions(assignmentId: string) {
    return this.listeningSubmissionModel.find({ assignment_id: assignmentId }).exec();
  }

  async getSubmission(id: string) {
    const submission = await this.listeningSubmissionModel.findOne({ _id: id }).exec();

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }
}
