import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';
import { Submission, SubmissionDocument } from './schemas/submission.schema';
import { WritingSubmission, WritingSubmissionDocument } from './writing/schemas/writing-submission.schema';
import { SpeakingResponse, SpeakingResponseDocument } from './speaking/schemas/speaking-response.schema';
import { ReadingService } from './reading/reading.service';
import { ListeningService } from './listening/listening.service';
import { WritingService } from './writing/writing.service';
import { SpeakingService } from './speaking/speaking.service';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
    @InjectModel(WritingSubmission.name)
    private writingSubmissionModel: Model<WritingSubmissionDocument>,
    @InjectModel(SpeakingResponse.name)
    private speakingResponseModel: Model<SpeakingResponseDocument>,
    private readonly readingService: ReadingService,
    private readonly listeningService: ListeningService,
    private readonly writingService: WritingService,
    private readonly speakingService: SpeakingService,
  ) {}

  async findAll() {
    const [reading, listening, writing, speaking] = await Promise.all([
      this.readingService.findAll(),
      this.listeningService.findAll(),
      this.writingService.findAll(),
      this.speakingService.findAll(),
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
}

