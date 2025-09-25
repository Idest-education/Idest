import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../schemas/assignment.schema';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { WritingSubmission, WritingSubmissionDocument } from './schemas/writing-submission.schema';
import { CreateWritingSubmissionDto } from './dto/create-writing-submission.dto';
import { generateSlugFromTitle } from '../utils/slug.util';

@Injectable()
export class WritingService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(WritingSubmission.name)
    private writingSubmissionModel: Model<WritingSubmissionDocument>,
  ) {}

  async createAssignment(dto: CreateAssignmentDto) {
    const data = {
      ...dto,
      slug: dto.slug ?? generateSlugFromTitle(dto.title),
      skill: 'writing',
    } as any;
    const created = new this.assignmentModel(data);
    return created.save();
  }

  async findAll() {
    return this.assignmentModel.find({ skill: 'writing' }).exec();
  }

  async findOne(id: string) {
    return this.assignmentModel.findOne({ _id: id, skill: 'writing' }).exec();
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'writing' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'writing' }).exec();
  }

  async submitEssay(dto: CreateWritingSubmissionDto) {
    const assignment = await this.assignmentModel.findOne({ _id: dto.assignment_id, skill: 'writing' }).exec();
    if (!assignment) throw new BadRequestException('assignment_id must reference a writing assignment');
    const payload = { ...dto } as any;
    const created = new this.writingSubmissionModel(payload);
    return created.save();
  }

  async getSubmission(id: string) {
    return this.writingSubmissionModel.findOne({ id }).exec();
  }
}


