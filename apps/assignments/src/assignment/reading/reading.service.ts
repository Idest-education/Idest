import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../schemas/assignment.schema';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { generateUniqueSlug } from '../utils/slug.util';

@Injectable()
export class ReadingService {
  constructor(
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
  ) {}

  private assertReadingSections(sections: CreateAssignmentDto['sections']) {
    for (const s of sections) {
      if (!s.reading_material) throw new BadRequestException('reading_material is required for reading sections');
      if (s.listening_material) throw new BadRequestException('listening_material is not allowed for reading sections');
    }
  }

  async createAssignment(dto: CreateAssignmentDto) {
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

  async findAll() {
    return this.assignmentModel.find({ skill: 'reading' }).exec();
  }

  async findOne(id: string) {
    return this.assignmentModel.findOne({ _id: id, skill: 'reading' }).exec();
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    if (dto.skill && dto.skill !== 'reading') throw new BadRequestException('skill must be reading');
    if (dto.sections) this.assertReadingSections(dto.sections as any);
    return this.assignmentModel
      .findOneAndUpdate({ _id: id, skill: 'reading' }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.assignmentModel.findOneAndDelete({ _id: id, skill: 'reading' }).exec();
  }
}


