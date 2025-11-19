import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';
import { ReadingService } from './reading/reading.service';
import { ListeningService } from './listening/listening.service';
import { WritingService } from './writing/writing.service';
import { SpeakingService } from './speaking/speaking.service';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
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
}

