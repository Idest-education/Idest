import { CreateObjectiveAssignmentBaseDto } from '../../dto/objective/objective-assignment.dto';

/** Reading assignment create body (material.type must be `reading` per section). */
export class CreateReadingAssignmentDto extends CreateObjectiveAssignmentBaseDto {}
