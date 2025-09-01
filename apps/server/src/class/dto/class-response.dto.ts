import { JsonValue } from "generated/prisma/runtime/library";
import { SessionResponseDto } from "src/session/dto/session-response.dto";

export class UserSummaryDto {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  role?: string;
}

export class ClassCountDto {
  members: number;
  teachers: number;
  sessions: number;
}

export class ClassResponseDto {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  is_group: boolean;
  invite_code?: string;
  created_by: string;
  schedule?: JsonValue | null;
  creator: UserSummaryDto;
  _count: ClassCountDto;
}


export class FullClassResponseDto extends ClassResponseDto {
  members: UserSummaryDto[];
  teachers: UserSummaryDto[];
  sessions: SessionResponseDto[];
}

export class UserClassesResponseDto {
  created: FullClassResponseDto[];
  teaching: FullClassResponseDto[];
  enrolled: FullClassResponseDto[];
}


export class PaginatedClassResponseDto {
  data: ClassResponseDto[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}
