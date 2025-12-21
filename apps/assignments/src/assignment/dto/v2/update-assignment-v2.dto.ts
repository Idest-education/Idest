import { PartialType } from '@nestjs/swagger';
import { CreateAssignmentV2Dto } from './create-assignment-v2.dto';

export class UpdateAssignmentV2Dto extends PartialType(CreateAssignmentV2Dto) {}


