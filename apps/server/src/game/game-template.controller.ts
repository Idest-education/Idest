import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { GameTemplateService } from './game-template.service';
import { CreateGameTemplateDto } from './dto/create-game-template.dto';
import { UpdateGameTemplateDto } from './dto/update-game-template.dto';

@Controller('game-templates')
@ApiTags('Game Templates')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GameTemplateController {
  constructor(private readonly service: GameTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List own game templates' })
  findAll(@CurrentUser() user: userPayload) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game template' })
  findOne(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a game template' })
  @ApiCreatedResponse({ description: 'Template created' })
  create(@CurrentUser() user: userPayload, @Body() dto: CreateGameTemplateDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a game template' })
  update(
    @CurrentUser() user: userPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGameTemplateDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a game template' })
  remove(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
