import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../schemas/assignment.schema';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { SpeakingAssignment, SpeakingAssignmentDocument } from './schemas/speaking-assignment.schema';
import { SpeakingResponse, SpeakingResponseDocument } from './schemas/speaking-response.schema';
import { CreateSpeakingResponseDto } from './dto/create-speaking-response.dto';
import { CreateSpeakingAssignmentDto } from './dto/create-speaking-assignment.dto';
import { generateUniqueSlug } from '../utils/slug.util';

@Injectable()
export class SpeakingService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(SpeakingAssignment.name)
    private speakingAssignmentModel: Model<SpeakingAssignmentDocument>,
    @InjectModel(SpeakingResponse.name)
    private speakingResponseModel: Model<SpeakingResponseDocument>,
  ) {}

  async createAssignment(dto: CreateAssignmentDto) {
    const data = { ...dto, skill: 'speaking' } as any;
    const created = new this.assignmentModel({
      ...data,
      slug: data.slug ?? await generateUniqueSlug(data.title, this.assignmentModel),
    });
    const saved = await created.save();
    // Also persist an empty SpeakingAssignment shell tied to this assignment id
    await new this.speakingAssignmentModel({ id: saved._id, parts: [] }).save();
    return saved;
  }

  async createSpeakingParts(assignmentId: string, dto: CreateSpeakingAssignmentDto) {
    const exists = await this.assignmentModel.findOne({ _id: assignmentId, skill: 'speaking' }).exec();
    if (!exists) throw new BadRequestException('assignment must exist and be speaking');
    const speaking = new this.speakingAssignmentModel({ id: assignmentId, parts: dto.parts });
    return speaking.save();
  }

  async findAll() {
    return this.assignmentModel.find({ skill: 'speaking' }).exec();
  }

  async findOne(id: string) {
    return this.assignmentModel.findOne({ _id: id, skill: 'speaking' }).exec();
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'speaking' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'speaking' }).exec();
  }

  async submitResponse(dto: CreateSpeakingResponseDto) {
    const assignment = await this.assignmentModel.findOne({ _id: dto.assignment_id, skill: 'speaking' }).exec();
    if (!assignment) throw new BadRequestException('assignment_id must reference a speaking assignment');
    const payload = { ...dto } as any;
    const created = new this.speakingResponseModel(payload);
    return created.save();
  }

  async getResponse(id: string) {
    return this.speakingResponseModel.findOne({ id }).exec();
  }
}


