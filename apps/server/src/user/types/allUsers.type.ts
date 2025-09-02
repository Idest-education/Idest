import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class AllUsersDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      description: 'User object',
    },
    description: 'Array of users for the current page',
  })
  users: User[];

  @ApiProperty({
    type: 'number',
    description: 'Total number of users matching the criteria',
    example: 100,
  })
  total: number;

  @ApiProperty({
    type: 'number',
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    type: 'number',
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    type: 'number',
    description: 'Total number of pages',
    example: 10,
  })
  totalPages: number;

  @ApiProperty({
    type: 'boolean',
    description: 'Whether there are more pages available',
    example: true,
  })
  hasMore: boolean;
}

export type AllUsers = AllUsersDto;
