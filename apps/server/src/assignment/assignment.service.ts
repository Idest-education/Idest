import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { FindAssignmentDto } from './dto/find-assignment.dto';
import { DeleteAssignmentDto } from './dto/delete-assignment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface ApiResponse {
  status: boolean;
  message: string;
  data?: any;
  statusCode?: number;
}

@Injectable()
export class AssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async create(createAssignmentDto: CreateAssignmentDto) {
    try {
      const assignmentUrl = this.configService.get<string>('ASSIGNMENT_URL');

      if (!assignmentUrl) {
        throw new InternalServerErrorException(
          'ASSIGNMENT_URL is not configured in environment variables',
        );
      }

      const { skill } = createAssignmentDto;
      const url = `${assignmentUrl}/${skill}/assignments`;

      const response = await firstValueFrom(
        this.httpService.post<ApiResponse>(url, createAssignmentDto),
      );

      const { status, message, data, statusCode } = response.data;

      if (status === true) {
        return data;
      }

      this.throwExceptionByStatusCode(statusCode || 500, message);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof UnprocessableEntityException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      if (error.response) {
        const { status, message, data, statusCode } = error.response.data;
        if (status === false) {
          this.throwExceptionByStatusCode(
            statusCode || error.response.status,
            message || 'External API error',
          );
        }
      }

      throw new InternalServerErrorException(
        `Failed to create assignment: ${error.message || error}`,
      );
    }
  }

  async findAll(findAssignmentDto: FindAssignmentDto) {
    try {
      const assignmentUrl = this.configService.get<string>('ASSIGNMENT_URL');

      if (!assignmentUrl) {
        throw new InternalServerErrorException(
          'ASSIGNMENT_URL is not configured in environment variables',
        );
      }

      const { skill, id } = findAssignmentDto;

      let url: string;

      if (skill && id) {
        url = `${assignmentUrl}/${skill}/assignment/${id}`;
      } else if (skill) {
        url = `${assignmentUrl}/${skill}/assignment`;
      } else if (id) {
        url = `${assignmentUrl}/assignment/${id}`;
      } else {
        url = `${assignmentUrl}/assignments`;
      }

      const response = await firstValueFrom(
        this.httpService.get<ApiResponse>(url),
      );

      const { status, message, data, statusCode } = response.data;

      if (status === true) {
        return data;
      }

      this.throwExceptionByStatusCode(statusCode || 500, message);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof UnprocessableEntityException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      if (error.response) {
        const { status, message, data, statusCode } = error.response.data;
        if (status === false) {
          this.throwExceptionByStatusCode(
            statusCode || error.response.status,
            message || 'External API error',
          );
        }
      }

      throw new InternalServerErrorException(
        `Failed to fetch assignments: ${error.message || error}`,
      );
    }
  }

  async update(id: string, createAssignmentDto: CreateAssignmentDto) {
    try {
      const assignmentUrl = this.configService.get<string>('ASSIGNMENT_URL');

      if (!assignmentUrl) {
        throw new InternalServerErrorException(
          'ASSIGNMENT_URL is not configured in environment variables',
        );
      }

      const { skill } = createAssignmentDto;
      const url = `${assignmentUrl}/${skill}/assignment/${id}`;

      const response = await firstValueFrom(
        this.httpService.patch<ApiResponse>(url, createAssignmentDto),
      );

      const { status, message, data, statusCode } = response.data;

      if (status === true) {
        return data;
      }

      this.throwExceptionByStatusCode(statusCode || 500, message);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof UnprocessableEntityException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      if (error.response) {
        const { status, message, data, statusCode } = error.response.data;
        if (status === false) {
          this.throwExceptionByStatusCode(
            statusCode || error.response.status,
            message || 'External API error',
          );
        }
      }

      throw new InternalServerErrorException(
        `Failed to update assignment: ${error.message || error}`,
      );
    }
  }

  async remove(deleteAssignmentDto: DeleteAssignmentDto) {
    try {
      const assignmentUrl = this.configService.get<string>('ASSIGNMENT_URL');

      if (!assignmentUrl) {
        throw new InternalServerErrorException(
          'ASSIGNMENT_URL is not configured in environment variables',
        );
      }

      const { skill, id } = deleteAssignmentDto;

      let url: string;

      if (skill) {
        url = `${assignmentUrl}/${skill}/assignment/${id}`;
      } else {
        url = `${assignmentUrl}/assignment/${id}`;
      }

      const response = await firstValueFrom(
        this.httpService.delete<ApiResponse>(url),
      );

      const { status, message, data, statusCode } = response.data;

      if (status === true) {
        return data;
      }

      this.throwExceptionByStatusCode(statusCode || 500, message);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof UnprocessableEntityException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      if (error.response) {
        const { status, message, data, statusCode } = error.response.data;
        if (status === false) {
          this.throwExceptionByStatusCode(
            statusCode || error.response.status,
            message || 'External API error',
          );
        }
      }

      throw new InternalServerErrorException(
        `Failed to delete assignment: ${error.message || error}`,
      );
    }
  }

  private throwExceptionByStatusCode(
    statusCode: number,
    message: string,
  ): never {
    switch (statusCode) {
      case 400:
        throw new BadRequestException(message);
      case 401:
        throw new UnauthorizedException(message);
      case 403:
        throw new ForbiddenException(message);
      case 404:
        throw new NotFoundException(message);
      case 409:
        throw new ConflictException(message);
      case 422:
        throw new UnprocessableEntityException(message);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new InternalServerErrorException(message);
      default:
        throw new InternalServerErrorException(
          message || `Unexpected error with status code: ${statusCode}`,
        );
    }
  }
}
