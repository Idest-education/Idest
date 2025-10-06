import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SpeakingAssignment, SpeakingAssignmentDocument } from '../schemas/speaking-assignment.schema';
import { SpeakingResponse, SpeakingResponseDocument } from './schemas/speaking-response.schema';
import { CreateSpeakingResponseDto } from './dto/create-speaking-response.dto';
import { CreateSpeakingAssignmentDto } from './dto/create-speaking-assignment.dto';
import { UpdateSpeakingAssignmentDto } from './dto/update-speaking-assignment.dto';
import { GradeService } from '../../grade/grade.service';

@Injectable()
export class SpeakingService {
  constructor(
    @InjectModel(SpeakingAssignment.name)
    private speakingAssignmentModel: Model<SpeakingAssignmentDocument>,
    @InjectModel(SpeakingResponse.name)
    private speakingResponseModel: Model<SpeakingResponseDocument>,
    private gradeService: GradeService,
  ) {}

  async createAssignment(dto: CreateSpeakingAssignmentDto) {
    const created = new this.speakingAssignmentModel(dto);
    return created.save();
  }

  async findAll() {
    return this.speakingAssignmentModel.find().exec();
  }

  async findOne(id: string) {
    return this.speakingAssignmentModel.findOne({ _id: id }).exec();
  }

  async update(id: string, dto: UpdateSpeakingAssignmentDto) {
    return this.speakingAssignmentModel
      .findOneAndUpdate({ _id: id }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.speakingAssignmentModel.findOneAndDelete({ _id: id }).exec();
  }

  async submitResponse(dto: CreateSpeakingResponseDto) {
    const assignment = await this.speakingAssignmentModel.findOne({ _id: dto.assignment_id }).exec();
    if (!assignment) throw new BadRequestException('assignment_id must reference a speaking assignment');
    
    let score: number | undefined;
    let feedback: string | undefined;
    
    if (dto.transcriptOne || dto.transcriptTwo || dto.transcriptThree) {
      let question = `Speaking Assignment: ${assignment.title}\n\n`;
      let answer = '';
      
      assignment.parts.forEach(part => {
        question += `Part ${part.part_number}: \n`;
        part.questions.forEach(q => {
          question += `Q${q.order_index}: ${q.prompt}\n`;
        });
        question += '\n';
      });
      
      if (dto.transcriptOne) {
        answer += `Part 1:\n${dto.transcriptOne}\n\n`;
      }
      if (dto.transcriptTwo) {
        answer += `Part 2:\n${dto.transcriptTwo}\n\n`;
      }
      if (dto.transcriptThree) {
        answer += `Part 3:\n${dto.transcriptThree}\n\n`;
      }
      
      const gradeResponseText = await this.gradeService.gradeSpeakingSubmission(question, answer.trim());
      
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
    }
    
    const payload = { 
      ...dto,
      score,
      feedback,
    } as any;
    const created = new this.speakingResponseModel(payload);
    return created.save();
  }

  async getResponse(id: string) {
    return this.speakingResponseModel.findOne({ id }).exec();
  }

  async getAllResponses() {
    return this.speakingResponseModel.find().exec();
  }

  async getUserResponses(userId: string) {
    return this.speakingResponseModel.find({ user_id: userId }).exec();
  }

  async getAssignmentResponses(assignmentId: string) {
    return this.speakingResponseModel.find({ assignment_id: assignmentId }).exec();
  }
}


