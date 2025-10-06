import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WritingAssignment, WritingAssignmentDocument } from '../schemas/writing-assignment.schema';
import { CreateWritingAssignmentDto } from './dto/create-writing-assignment.dto';
import { UpdateWritingAssignmentDto } from './dto/update-writing-assignment.dto';
import { WritingSubmission, WritingSubmissionDocument } from './schemas/writing-submission.schema';
import { CreateWritingSubmissionDto } from './dto/create-writing-submission.dto';
import { GradeService } from '../../grade/grade.service';

@Injectable()
export class WritingService {
  constructor(
    @InjectModel(WritingAssignment.name)
    private writingAssignmentModel: Model<WritingAssignmentDocument>,
    @InjectModel(WritingSubmission.name)
    private writingSubmissionModel: Model<WritingSubmissionDocument>,
    private gradeService: GradeService,
  ) {}

  async createAssignment(dto: CreateWritingAssignmentDto) {
    const created = new this.writingAssignmentModel(dto);
    return created.save();
  }

  async findAll() {
    return this.writingAssignmentModel.find().exec();
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
    
    let question = `Task 1: ${assignment.taskone}\nTask 2: ${assignment.tasktwo}`;
    if (assignment.imgDescription) {
      question += `\n\nImage Description for task 1: ${assignment.imgDescription}`;
    }
    
    const submission = `Task 1 Answer:\n${dto.contentOne}\n\nTask 2 Answer:\n${dto.contentTwo}`;
    
    const gradeResponseText = await this.gradeService.gradeWritingSubmission(submission, question);
    
    let score: number | undefined;
    let feedback: string | undefined;
    try {
      let jsonText = gradeResponseText.trim();
      
      const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }
      
      const gradeResponse = JSON.parse(jsonText);
      score = gradeResponse.score;
      feedback = gradeResponse.feedback;
    } catch (error) {
      console.error('Failed to parse grade response:', error);
      console.error('Raw response:', gradeResponseText);
    }
    
    const payload = { 
      ...dto,
      score,
      feedback,
    } as any;
    const created = new this.writingSubmissionModel(payload);
    return created.save();
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


