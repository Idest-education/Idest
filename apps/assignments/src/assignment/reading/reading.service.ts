import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReadingAssignment, ReadingAssignmentDocument } from '../schemas/reading-assignment.schema';
import { ReadingSubmission, ReadingSubmissionDocument } from '../schemas/reading-submission.schema';
import { CreateReadingAssignmentDto } from './dto/create-reading-assignment.dto';
import { UpdateObjectiveAssignmentDto } from '../dto/objective/update-objective-assignment.dto';
import { SubmitObjectiveAssignmentDto } from '../dto/objective/submit-objective.dto';
import { generateUniqueSlug } from '../utils/slug.util';
import { gradeObjectiveAssignment } from '../utils/grading-objective.util';
import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class ReadingService {
  constructor(
    @InjectModel(ReadingAssignment.name)
    private readingAssignmentModel: Model<ReadingAssignmentDocument>,
    @InjectModel(ReadingSubmission.name)
    private readingSubmissionModel: Model<ReadingSubmissionDocument>,
  ) {}

  private assertReadingSections(sections: CreateReadingAssignmentDto['sections']) {
    for (const s of sections) {
      if ((s as any)?.material?.type !== 'reading') {
        throw new BadRequestException('material.type must be reading for reading sections');
      }
    }
  }

  async createAssignment(dto: CreateReadingAssignmentDto) {
    this.assertReadingSections(dto.sections);
    const data = {
      ...dto,
      slug: dto.slug ?? (await generateUniqueSlug(dto.title, this.readingAssignmentModel)),
    } as any;
    const created = new this.readingAssignmentModel(data);
    return created.save();
  }

  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<any> | any[]> {
    if (!pagination) {
      return this.readingAssignmentModel.find().exec();
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 6;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.readingAssignmentModel.find().skip(skip).limit(limit).exec(),
      this.readingAssignmentModel.countDocuments().exec(),
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
    const doc: any = await this.readingAssignmentModel.findOne({ _id: id }).lean().exec();
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
    if (dto.sections) this.assertReadingSections(dto.sections as any);
    return this.readingAssignmentModel
      .findOneAndUpdate({ _id: id }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.readingAssignmentModel.findOneAndDelete({ _id: id }).exec();
  }

  async gradeSubmission(submission: SubmitObjectiveAssignmentDto): Promise<ReadingSubmission> {
    const assignment = await this.readingAssignmentModel.findOne({ _id: submission.assignment_id }).exec();

    if (!assignment) {
      throw new NotFoundException('Reading assignment not found');
    }

    const gradingResult = gradeObjectiveAssignment(assignment as any, submission as any);

    const submissionData = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      answers: { section_answers: submission.section_answers },
      ...gradingResult,
    };

    const createdSubmission = new this.readingSubmissionModel(submissionData);
    return createdSubmission.save();
  }

  async getAllSubmissions() {
    return this.readingSubmissionModel.find().exec();
  }

  async getUserSubmissions(userId: string) {
    return this.readingSubmissionModel.find({ submitted_by: userId }).exec();
  }

  async getAssignmentSubmissions(assignmentId: string) {
    return this.readingSubmissionModel.find({ assignment_id: assignmentId }).exec();
  }

  async getSubmission(id: string) {
    const submission = await this.readingSubmissionModel.findOne({ _id: id }).lean().exec();

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const needsDetailHydration =
      !submission.details ||
      !Array.isArray(submission.details) ||
      submission.details.every((sec: any) =>
        (sec.questions ?? []).every((q: any) => {
          const noParts = !q.parts || q.parts.length === 0;
          const missingSubmitted =
            Array.isArray(q.parts) && q.parts.some((p: any) => p.submitted_answer === undefined);
          return noParts || missingSubmitted;
        }),
      );

    if (!needsDetailHydration) {
      return submission;
    }

    const assignment = await this.readingAssignmentModel.findOne({ _id: submission.assignment_id }).lean().exec();

    if (!assignment) {
      return submission;
    }

    const answers = (submission as any).answers;
    const sectionAnswers = answers?.section_answers ?? [];
    const normalizedSubmission = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      section_answers: sectionAnswers,
    };
    const regraded = gradeObjectiveAssignment(assignment as any, normalizedSubmission as any);
    return {
      ...submission,
      ...regraded,
    };
  }
}
