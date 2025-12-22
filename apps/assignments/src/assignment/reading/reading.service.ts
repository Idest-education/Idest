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
export class ReadingService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
  ) {}

  private assertReadingSections(sections: CreateAssignmentV2Dto['sections']) {
    for (const s of sections) {
      if ((s as any)?.material?.type !== 'reading') throw new BadRequestException('material.type must be reading for reading sections');
    }
  }

  async createAssignment(dto: CreateAssignmentV2Dto) {
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
    const doc: any = await this.assignmentModel.findOne({ _id: id, skill: 'reading' }).lean().exec();
    if (!doc) return doc;
    // Remove answer keys from exam payloads
    for (const section of doc.sections ?? []) {
      for (const group of section.question_groups ?? []) {
        for (const q of group.questions ?? []) {
          delete q.answer_key;
        }
      }
    }
    return doc;
  }

  async update(id: string, dto: UpdateAssignmentV2Dto) {
    if (dto.skill && dto.skill !== 'reading') throw new BadRequestException('skill must be reading');
    if (dto.sections) this.assertReadingSections(dto.sections as any);
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'reading' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'reading' }).exec();
  }

  async gradeSubmission(submission: SubmitAssignmentV2Dto): Promise<Submission> {
    const assignment = await this.assignmentModel
      .findOne({ _id: submission.assignment_id, skill: 'reading' })
      .exec();

    if (!assignment) {
      throw new NotFoundException('Reading assignment not found');
    }

    const gradingResult = gradeAssignmentV2(assignment as any, submission as any);

    const submissionData = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      skill: 'reading',
      answers_v2: submission.section_answers,
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
      .lean()
      .exec();

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

    const assignment = await this.assignmentModel
      .findOne({ _id: submission.assignment_id, skill: 'reading' })
      .lean()
      .exec();

    if (!assignment) {
      return submission;
    }

    // Re-grade to populate parts and correct answers for UI rendering
    const normalizedSubmission = {
      assignment_id: submission.assignment_id,
      submitted_by: submission.submitted_by,
      section_answers: (submission as any).answers_v2 ?? (submission as any).section_answers ?? [],
    };
    const regraded = gradeAssignmentV2(assignment as any, normalizedSubmission as any);
    return {
      ...submission,
      ...regraded,
    };
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
