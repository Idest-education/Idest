import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReadingAssignment, ReadingAssignmentDocument } from './schemas/reading-assignment.schema';
import { ListeningAssignment, ListeningAssignmentDocument } from './schemas/listening-assignment.schema';
import { WritingAssignment, WritingAssignmentDocument } from './schemas/writing-assignment.schema';
import { SpeakingAssignment, SpeakingAssignmentDocument } from './schemas/speaking-assignment.schema';
import { ReadingSubmission, ReadingSubmissionDocument } from './schemas/reading-submission.schema';
import { ListeningSubmission, ListeningSubmissionDocument } from './schemas/listening-submission.schema';
import { WritingSubmission, WritingSubmissionDocument } from './writing/schemas/writing-submission.schema';
import { SpeakingSubmission, SpeakingSubmissionDocument } from './speaking/schemas/speaking-submission.schema';
import { ReadingService } from './reading/reading.service';
import { ListeningService } from './listening/listening.service';
import { WritingService } from './writing/writing.service';
import { SpeakingService } from './speaking/speaking.service';
import { PaginationDto } from './dto/pagination.dto';

type Skill = 'reading' | 'listening' | 'writing' | 'speaking';
type SubmissionStatus = 'pending' | 'graded' | 'failed';

export interface MySubmissionListItem {
  submissionId: string;
  assignmentId: string;
  skill: Skill;
  createdAt: Date;
  score?: number;
  assignmentTitle?: string;
  status?: SubmissionStatus;
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
    @InjectModel(ReadingAssignment.name)
    private readingAssignmentModel: Model<ReadingAssignmentDocument>,
    @InjectModel(ListeningAssignment.name)
    private listeningAssignmentModel: Model<ListeningAssignmentDocument>,
    @InjectModel(WritingAssignment.name)
    private writingAssignmentModel: Model<WritingAssignmentDocument>,
    @InjectModel(SpeakingAssignment.name)
    private speakingAssignmentModel: Model<SpeakingAssignmentDocument>,
    @InjectModel(ReadingSubmission.name)
    private readingSubmissionModel: Model<ReadingSubmissionDocument>,
    @InjectModel(ListeningSubmission.name)
    private listeningSubmissionModel: Model<ListeningSubmissionDocument>,
    @InjectModel(WritingSubmission.name)
    private writingSubmissionModel: Model<WritingSubmissionDocument>,
    @InjectModel(SpeakingSubmission.name)
    private speakingSubmissionModel: Model<SpeakingSubmissionDocument>,
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
    const [r, l, w, s] = await Promise.all([
      this.readingAssignmentModel.findById(id).lean().exec(),
      this.listeningAssignmentModel.findById(id).lean().exec(),
      this.writingAssignmentModel.findById(id).lean().exec(),
      this.speakingAssignmentModel.findById(id).lean().exec(),
    ]);
    const found = r || l || w || s;
    if (!found) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }
    return found;
  }

  async remove(id: string) {
    const [r, l, w, s] = await Promise.all([
      this.readingAssignmentModel.findByIdAndDelete(id).exec(),
      this.listeningAssignmentModel.findByIdAndDelete(id).exec(),
      this.writingAssignmentModel.findByIdAndDelete(id).exec(),
      this.speakingAssignmentModel.findByIdAndDelete(id).exec(),
    ]);
    const deleted = r || l || w || s;
    if (!deleted) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }
    return deleted;
  }

  async getAllSubmissions() {
    const [readingSubmissions, listeningSubmissions, writingSubmissions, speakingSubmissions] =
      await Promise.all([
        this.readingSubmissionModel.find().exec(),
        this.listeningSubmissionModel.find().exec(),
        this.writingSubmissionModel.find().exec(),
        this.speakingSubmissionModel.find().exec(),
      ]);

    return {
      reading: readingSubmissions,
      listening: listeningSubmissions,
      writing: writingSubmissions,
      speaking: speakingSubmissions,
    };
  }

  async searchAssignmentsByName(name: string) {
    const searchRegex = new RegExp(name, 'i');
    const [r, l, w, s] = await Promise.all([
      this.readingAssignmentModel.find({ title: { $regex: searchRegex } }).exec(),
      this.listeningAssignmentModel.find({ title: { $regex: searchRegex } }).exec(),
      this.writingAssignmentModel.find({ title: { $regex: searchRegex } }).exec(),
      this.speakingAssignmentModel.find({ title: { $regex: searchRegex } }).exec(),
    ]);
    return [...r, ...l, ...w, ...s];
  }

  async searchSubmissionsByName(name: string) {
    const searchRegex = new RegExp(name, 'i');

    const matchingAssignments = await Promise.all([
      this.readingAssignmentModel.find({ title: { $regex: searchRegex } }).select('_id').lean().exec(),
      this.listeningAssignmentModel.find({ title: { $regex: searchRegex } }).select('_id').lean().exec(),
      this.writingAssignmentModel.find({ title: { $regex: searchRegex } }).select('_id').lean().exec(),
      this.speakingAssignmentModel.find({ title: { $regex: searchRegex } }).select('_id').lean().exec(),
    ]);

    const assignmentIds = matchingAssignments.flat().map((a) => a._id);

    if (assignmentIds.length === 0) {
      return {
        reading: [],
        listening: [],
        writing: [],
        speaking: [],
      };
    }

    const [readingSubmissions, listeningSubmissions, writingSubmissions, speakingSubmissions] =
      await Promise.all([
        this.readingSubmissionModel.find({ assignment_id: { $in: assignmentIds } }).exec(),
        this.listeningSubmissionModel.find({ assignment_id: { $in: assignmentIds } }).exec(),
        this.writingSubmissionModel.find({ assignment_id: { $in: assignmentIds } }).exec(),
        this.speakingSubmissionModel.find({ assignment_id: { $in: assignmentIds } }).exec(),
      ]);

    return {
      reading: readingSubmissions,
      listening: listeningSubmissions,
      writing: writingSubmissions,
      speaking: speakingSubmissions,
    };
  }

  async getMySubmissions(
    userId: string,
    pagination?: PaginationDto,
    skill?: Skill,
  ): Promise<Paginated<MySubmissionListItem>> {
    const page = typeof pagination?.page === 'number' ? pagination.page : Number(pagination?.page) || 1;
    const limit = typeof pagination?.limit === 'number' ? pagination.limit : Number(pagination?.limit) || 6;

    if (!userId) {
      throw new BadRequestException('Missing user id');
    }

    const allowed: Skill[] = ['reading', 'listening', 'writing', 'speaking'];
    if (skill && !allowed.includes(skill)) {
      throw new BadRequestException(`Invalid skill: ${skill}`);
    }

    const skip = (page - 1) * limit;
    const prefetch = page * limit;

    const includeReading = !skill || skill === 'reading';
    const includeListening = !skill || skill === 'listening';
    const includeWriting = !skill || skill === 'writing';
    const includeSpeaking = !skill || skill === 'speaking';

    const [
      readingDocs,
      listeningDocs,
      writingDocs,
      speakingDocs,
      totalReading,
      totalListening,
      totalWriting,
      totalSpeaking,
    ] = await Promise.all([
      includeReading
        ? this.readingSubmissionModel
            .find({ submitted_by: userId })
            .sort({ created_at: -1 })
            .limit(prefetch)
            .lean()
            .exec()
        : Promise.resolve([] as any[]),
      includeListening
        ? this.listeningSubmissionModel
            .find({ submitted_by: userId })
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
        ? this.speakingSubmissionModel
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .limit(prefetch)
            .lean()
            .exec()
        : Promise.resolve([] as any[]),
      includeReading ? this.readingSubmissionModel.countDocuments({ submitted_by: userId }).exec() : Promise.resolve(0),
      includeListening
        ? this.listeningSubmissionModel.countDocuments({ submitted_by: userId }).exec()
        : Promise.resolve(0),
      includeWriting ? this.writingSubmissionModel.countDocuments({ user_id: userId }).exec() : Promise.resolve(0),
      includeSpeaking ? this.speakingSubmissionModel.countDocuments({ user_id: userId }).exec() : Promise.resolve(0),
    ]);

    const normalized: MySubmissionListItem[] = [
      ...readingDocs.map((s: any) => ({
        submissionId: String(s._id ?? s.id),
        assignmentId: String(s.assignment_id),
        skill: 'reading' as const,
        createdAt: new Date(s.created_at),
        score: typeof s.score === 'number' ? s.score : undefined,
        status: 'graded' as const,
      })),
      ...listeningDocs.map((s: any) => ({
        submissionId: String(s._id ?? s.id),
        assignmentId: String(s.assignment_id),
        skill: 'listening' as const,
        createdAt: new Date(s.created_at),
        score: typeof s.score === 'number' ? s.score : undefined,
        status: 'graded' as const,
      })),
      ...writingDocs.map((s: any) => ({
        submissionId: String(s._id ?? s.id),
        assignmentId: String(s.assignment_id),
        skill: 'writing' as const,
        createdAt: new Date(s.created_at),
        score: typeof s.score === 'number' ? s.score : undefined,
        status: (s.status as SubmissionStatus) ?? (typeof s.score === 'number' ? 'graded' : 'pending'),
      })),
      ...speakingDocs.map((s: any) => ({
        submissionId: String(s._id ?? s.id),
        assignmentId: String(s.assignment_id),
        skill: 'speaking' as const,
        createdAt: new Date(s.created_at),
        score: typeof s.score === 'number' ? s.score : undefined,
        status: (s.status as SubmissionStatus) ?? (typeof s.score === 'number' ? 'graded' : 'pending'),
      })),
    ];

    normalized.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const pageItems = normalized.slice(skip, skip + limit);

    const idsBySkill: Record<Skill, Set<string>> = {
      reading: new Set(),
      listening: new Set(),
      writing: new Set(),
      speaking: new Set(),
    };
    for (const item of pageItems) {
      idsBySkill[item.skill].add(item.assignmentId);
    }

    const [rlA, llA, wAssignments, sAssignments] = await Promise.all([
      idsBySkill.reading.size
        ? this.readingAssignmentModel
            .find({ _id: { $in: Array.from(idsBySkill.reading) } })
            .select('_id title')
            .lean()
            .exec()
        : Promise.resolve([] as any[]),
      idsBySkill.listening.size
        ? this.listeningAssignmentModel
            .find({ _id: { $in: Array.from(idsBySkill.listening) } })
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
    for (const a of rlA) titleMap.set(String(a._id), String(a.title));
    for (const a of llA) titleMap.set(String(a._id), String(a.title));
    for (const a of wAssignments) titleMap.set(String(a._id), String(a.title));
    for (const a of sAssignments) titleMap.set(String(a._id), String(a.title));

    const enriched = pageItems.map((item) => ({
      ...item,
      assignmentTitle: titleMap.get(item.assignmentId) ?? item.assignmentTitle,
    }));

    const total = totalReading + totalListening + totalWriting + totalSpeaking;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Number(totalPages),
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
