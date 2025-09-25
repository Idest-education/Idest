import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../schemas/assignment.schema';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { generateSlugFromTitle } from '../utils/slug.util';

@Injectable()
export class ListeningService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
  ) {}

  private assertListeningSections(sections: CreateAssignmentDto['sections']) {
    for (const s of sections) {
      if (!s.listening_material) throw new BadRequestException('listening_material is required for listening sections');
      if (s.reading_material) throw new BadRequestException('reading_material is not allowed for listening sections');
    }
  }

  async createAssignment(dto: CreateAssignmentDto) {
    if (dto.skill && dto.skill !== 'listening') throw new BadRequestException('skill must be listening');
    this.assertListeningSections(dto.sections);
    const data = {
      ...dto,
      slug: dto.slug ?? generateSlugFromTitle(dto.title),
      skill: 'listening',
    } as any;
    const created = new this.assignmentModel(data);
    return created.save();
  }

  async findAll() {
    return this.assignmentModel.find({ skill: 'listening' }).exec();
  }

  async findOne(id: string) {
    return this.assignmentModel.findOne({ _id: id, skill: 'listening' }).exec();
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    if (dto.skill && dto.skill !== 'listening') throw new BadRequestException('skill must be listening');
    if (dto.sections) this.assertListeningSections(dto.sections as any);
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'listening' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'listening' }).exec();
  }
}


