import { PartialType } from '@nestjs/swagger';
import { CreateSpeakingAssignmentDto } from './create-speaking-assignment.dto';

export class UpdateSpeakingAssignmentDto extends PartialType(CreateSpeakingAssignmentDto) {}

