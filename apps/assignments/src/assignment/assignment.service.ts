import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';
import { Submission, SubmissionDocument } from './schemas/submission.schema';
import { WritingAssignment, WritingAssignmentDocument } from './schemas/writing-assignment.schema';
import { SpeakingAssignment, SpeakingAssignmentDocument } from './schemas/speaking-assignment.schema';
import { WritingSubmission, WritingSubmissionDocument } from './writing/schemas/writing-submission.schema';
import { SpeakingResponse, SpeakingResponseDocument } from './speaking/schemas/speaking-response.schema';
import { ReadingService } from './reading/reading.service';
import { ListeningService } from './listening/listening.service';
import { WritingService } from './writing/writing.service';
import { SpeakingService } from './speaking/speaking.service';
import { PaginationDto } from './dto/pagination.dto';

type Skill = 'reading' | 'listening' | 'writing' | 'speaking';

export interface MySubmissionListItem {
  submissionId: string;
  assignmentId: string;
  skill: Skill;
  createdAt: Date;
  score?: number;
  assignmentTitle?: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class AssignmentService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
    @InjectModel(WritingAssignment.name)
    private writingAssignmentModel: Model<WritingAssignmentDocument>,
    @InjectModel(SpeakingAssignment.name)
    private speakingAssignmentModel: Model<SpeakingAssignmentDocument>,
    @InjectModel(WritingSubmission.name)
    private writingSubmissionModel: Model<WritingSubmissionDocument>,
    @InjectModel(SpeakingResponse.name)
    private speakingResponseModel: Model<SpeakingResponseDocument>,
    private readonly readingService: ReadingService,
    private readonly listeningService: ListeningService,
    private readonly writingService: WritingService,
    private readonly speakingService: SpeakingService,
  ) {}

  async findAll(pagination?: PaginationDto) {
    const [reading, listening, writing, speaking] = await Promise.all([
      this.readingService.findAll(pagination),
      this.listeningService.findAll(pagination),
      this.writingService.findAll(pagination),
      this.speakingService.findAll(pagination),
    ]);

    return {
      reading,
      listening,
      writing,
      speaking,
    };
  }

  async findOne(id: string) {
    const assignment = await this.assignmentModel.findById(id).exec();
    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }
    return assignment;
  }

  async remove(id: string) {
    const result = await this.assignmentModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }
    return result;
  }

  async getAllSubmissions() {
    const [readingListeningSubmissions, writingSubmissions, speakingSubmissions] = await Promise.all([
      this.submissionModel.find().exec(),
      this.writingSubmissionModel.find().exec(),
      this.speakingResponseModel.find().exec(),
    ]);

    return {
      reading: readingListeningSubmissions.filter(s => s.skill === 'reading'),
      listening: readingListeningSubmissions.filter(s => s.skill === 'listening'),
      writing: writingSubmissions,
      speaking: speakingSubmissions,
    };
  }

  async searchAssignmentsByName(name: string) {
    const searchRegex = new RegExp(name, 'i');
    const assignments = await this.assignmentModel
      .find({ title: { $regex: searchRegex } })
      .exec();
    return assignments;
  }

  async searchSubmissionsByName(name: string) {
    const searchRegex = new RegExp(name, 'i');
    
    // First, find assignments matching the name
    const matchingAssignments = await this.assignmentModel
      .find({ title: { $regex: searchRegex } })
      .select('_id')
      .exec();
    
    const assignmentIds = matchingAssignments.map(a => a._id);
    
    if (assignmentIds.length === 0) {
      return {
        reading: [],
        listening: [],
        writing: [],
        speaking: [],
      };
    }

    // Find submissions for matching assignments
    const [readingListeningSubmissions, writingSubmissions, speakingSubmissions] = await Promise.all([
      this.submissionModel.find({ assignment_id: { $in: assignmentIds } }).exec(),
      this.writingSubmissionModel.find({ assignment_id: { $in: assignmentIds } }).exec(),
      this.speakingResponseModel.find({ assignment_id: { $in: assignmentIds } }).exec(),
    ]);

    return {
      reading: readingListeningSubmissions.filter(s => s.skill === 'reading'),
      listening: readingListeningSubmissions.filter(s => s.skill === 'listening'),
      writing: writingSubmissions,
      speaking: speakingSubmissions,
    };
  }

  async getMySubmissions(
    userId: string,
    pagination?: PaginationDto,
    skill?: Skill,
  ): Promise<Paginated<MySubmissionListItem>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 6;

    if (!userId) {
      throw new BadRequestException('Missing user id');
    }

    const allowed: Skill[] = ['reading', 'listening', 'writing', 'speaking'];
    if (skill && !allowed.includes(skill)) {
      throw new BadRequestException(`Invalid skill: ${skill}`);
    }

    const skip = (page - 1) * limit;
    const prefetch = page * limit; // to support merge-sorting across sources

    // Build queries depending on skill
    const includeReadingListening = !skill || skill === 'reading' || skill === 'listening';
    const includeWriting = !skill || skill === 'writing';
    const includeSpeaking = !skill || skill === 'speaking';

    const submissionFilter: any = { submitted_by: userId };
    if (skill === 'reading' || skill === 'listening') {
      submissionFilter.skill = skill;
    } else if (!skill) {
      submissionFilter.skill = { $in: ['reading', 'listening'] };
    }

    const [readingListeningDocs, writingDocs, speakingDocs, totalReadingListening, totalWriting, totalSpeaking] =
      await Promise.all([
        includeReadingListening
          ? this.submissionModel
              .find(submissionFilter)
              .sort({ created_at: -1 })
              .limit(prefetch)
              .lean()
              .exec()
          : Promise.resolve([] as any[]),
        includeWriting
          ? this.writingSubmissionModel
              .find({ user_id: userId })
              .sort({ created_at: -1 })
              .limit(prefetch)
              .lean()
              .exec()
          : Promise.resolve([] as any[]),
        includeSpeaking
          ? this.speakingResponseModel
              .find({ user_id: userId })
              .sort({ created_at: -1 })
              .limit(prefetch)
              .lean()
              .exec()
          : Promise.resolve([] as any[]),
        includeReadingListening
          ? this.submissionModel.countDocuments(submissionFilter).exec()
          : Promise.resolve(0),
        includeWriting
          ? this.writingSubmissionModel.countDocuments({ user_id: userId }).exec()
          : Promise.resolve(0),
        includeSpeaking
          ? this.speakingResponseModel.countDocuments({ user_id: userId }).exec()
          : Promise.resolve(0),
      ]);

    const normalized: MySubmissionListItem[] = [
      ...readingListeningDocs.map((s: any) => ({
        submissionId: String(s._id ?? s.id),
        assignmentId: String(s.assignment_id),
        skill: s.skill as Skill,
        createdAt: new Date(s.created_at),
        score: typeof s.score === 'number' ? s.score : undefined,
      })),
      ...writingDocs.map((s: any) => ({
        submissionId: String(s.id ?? s._id),
        assignmentId: String(s.assignment_id),
        skill: 'writing' as const,
        createdAt: new Date(s.created_at),
        score: typeof s.score === 'number' ? s.score : undefined,
      })),
      ...speakingDocs.map((s: any) => ({
        submissionId: String(s.id ?? s._id),
        assignmentId: String(s.assignment_id),
        skill: 'speaking' as const,
        createdAt: new Date(s.created_at),
        score: typeof s.score === 'number' ? s.score : undefined,
      })),
    ];

    normalized.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const pageItems = normalized.slice(skip, skip + limit);

    // Enrich page items with assignment titles (best-effort)
    const idsBySkill: Record<Skill, Set<string>> = {
      reading: new Set(),
      listening: new Set(),
      writing: new Set(),
      speaking: new Set(),
    };
    for (const item of pageItems) {
      idsBySkill[item.skill].add(item.assignmentId);
    }

    const [rlAssignments, wAssignments, sAssignments] = await Promise.all([
      (idsBySkill.reading.size || idsBySkill.listening.size)
        ? this.assignmentModel
            .find({ _id: { $in: Array.from(new Set([...idsBySkill.reading, ...idsBySkill.listening])) } })
            .select('_id title')
            .lean()
            .exec()
        : Promise.resolve([] as any[]),
      idsBySkill.writing.size
        ? this.writingAssignmentModel
            .find({ _id: { $in: Array.from(idsBySkill.writing) } })
            .select('_id title')
            .lean()
            .exec()
        : Promise.resolve([] as any[]),
      idsBySkill.speaking.size
        ? this.speakingAssignmentModel
            .find({ _id: { $in: Array.from(idsBySkill.speaking) } })
            .select('_id title')
            .lean()
            .exec()
        : Promise.resolve([] as any[]),
    ]);

    const titleMap = new Map<string, string>();
    for (const a of rlAssignments) titleMap.set(String(a._id), String(a.title));
    for (const a of wAssignments) titleMap.set(String(a._id), String(a.title));
    for (const a of sAssignments) titleMap.set(String(a._id), String(a.title));

    const enriched = pageItems.map((item) => ({
      ...item,
      assignmentTitle: titleMap.get(item.assignmentId) ?? item.assignmentTitle,
    }));

    const total = totalReadingListening + totalWriting + totalSpeaking;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: enriched,
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
}

