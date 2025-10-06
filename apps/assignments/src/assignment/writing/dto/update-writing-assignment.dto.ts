import { PartialType } from '@nestjs/swagger';
import { CreateWritingAssignmentDto } from './create-writing-assignment.dto';

export class UpdateWritingAssignmentDto extends PartialType(CreateWritingAssignmentDto) {}

