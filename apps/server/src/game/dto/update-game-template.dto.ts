import { PartialType } from '@nestjs/swagger';
import { CreateGameTemplateDto } from './create-game-template.dto';

export class UpdateGameTemplateDto extends PartialType(CreateGameTemplateDto) {}
