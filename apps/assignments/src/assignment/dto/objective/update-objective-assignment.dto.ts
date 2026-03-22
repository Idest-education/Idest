import { PartialType } from '@nestjs/swagger';
import { CreateObjectiveAssignmentBaseDto } from './objective-assignment.dto';

export class UpdateObjectiveAssignmentDto extends PartialType(CreateObjectiveAssignmentBaseDto) {}
