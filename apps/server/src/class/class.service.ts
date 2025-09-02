import { Injectable } from '@nestjs/common';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AddClassMemberDto, AddClassTeacherDto } from './dto/class-member.dto';
import { BulkStudentIdsDto } from './dto/bulk-members.dto';
import {
  ClassCountDto,
  ClassResponseDto,
  FullClassResponseDto,
  PaginatedClassResponseDto,
  UserClassesResponseDto,
  UserSummaryDto,
} from './dto/class-response.dto';
import { ClassQueryService } from './service/class-query.service';
import { ClassCRUDService } from './service/class-CRUD.service';
import { ClassMembershipService } from './service/class-membership.service';

@Injectable()
export class ClassService {
  constructor(
    private readonly queryService: ClassQueryService,
    private readonly crudService: ClassCRUDService,
    private readonly membershipService: ClassMembershipService,
  ) {}

  // CRUD Operations
  /**
   * Create a new class
   */
  async createClass(
    user: userPayload,
    dto: CreateClassDto,
  ): Promise<ClassResponseDto> {
    return this.crudService.createClass(user, dto);
  }

  /**
   * Update class details
   */
  async updateClass(
    classId: string,
    userId: string,
    dto: UpdateClassDto,
  ): Promise<FullClassResponseDto> {
    return this.crudService.updateClass(classId, userId, dto);
  }

  /**
   * Regenerate invite code (creator or teacher)
   */
  async regenerateInviteCode(classId: string, userId: string): Promise<string> {
    return this.crudService.regenerateInviteCode(classId, userId);
  }

  /**
   * Update class settings (creator or teacher)
   */
  async updateClassSettings(
    classId: string,
    userId: string,
    dto: UpdateClassDto,
  ): Promise<ClassResponseDto> {
    return this.crudService.updateClassSettings(classId, userId, dto);
  }

  /**
   * Delete class (only creator)
   */
  async deleteClass(classId: string, userId: string): Promise<void> {
    return this.crudService.deleteClass(classId, userId);
  }

  // Query Operations
  /**
   * Get class by slug with full details
   */
  async getClassBySlug(
    slug: string,
    userId: string,
  ): Promise<FullClassResponseDto> {
    return this.queryService.getClassBySlug(slug, userId);
  }

  /**
   * Get all classes for a user (as creator, teacher, or student)
   */
  async getUserClasses(userId: string): Promise<UserClassesResponseDto> {
    return this.queryService.getUserClasses(userId);
  }

  /**
   * Get class by ID with full details
   */
  async getClassById(
    classId: string,
    userId: string,
  ): Promise<FullClassResponseDto> {
    return this.queryService.getClassById(classId, userId);
  }

  /**
   * Get class members (students)
   */
  async getClassMembers(
    classId: string,
    userId: string,
  ): Promise<UserSummaryDto[]> {
    return this.queryService.getClassMembers(classId, userId);
  }

  /**
   * Get class teachers
   */
  async getClassTeachers(
    classId: string,
    userId: string,
  ): Promise<UserSummaryDto[]> {
    return this.queryService.getClassTeachers(classId, userId);
  }

  /**
   * Get class statistics
   */
  async getClassStatistics(
    classId: string,
    userId: string,
  ): Promise<ClassCountDto> {
    return this.queryService.getClassStatistics(classId, userId);
  }

  /**
   * Search classes by name/description the user can see (own, teaching, enrolled, or public classes)
   */
  async searchClasses(userId: string, q: string): Promise<ClassResponseDto[]> {
    return this.queryService.searchClasses(userId, q);
  }

  /**
   * Get public classes
   */
  async getPublicClasses(): Promise<ClassResponseDto[]> {
    return this.queryService.getPublicClasses();
  }

  /**
   * Admin: Get all classes
   */
  async getAllClasses(params: {
    page: number;
    pageSize: number;
    q?: string;
    sortBy?: 'name' | 'created_at' | 'updated_at';
    sortOrder?: 'asc' | 'desc';
    creatorId?: string;
  }): Promise<PaginatedClassResponseDto> {
    return this.queryService.getAllClasses(params);
  }

  /**
   * Validate invite code
   */
  async validateInviteCode(
    code: string,
  ): Promise<{ valid: boolean; class: ClassResponseDto | null }> {
    return this.queryService.validateInviteCode(code);
  }

  // Membership Operations
  /**
   * Add a student to the class
   */
  async addStudent(
    classId: string,
    userId: string,
    dto: AddClassMemberDto,
  ): Promise<FullClassResponseDto> {
    return this.membershipService.addStudent(classId, userId, dto);
  }

  /**
   * Add a teacher to the class
   */
  async addTeacher(
    classId: string,
    userId: string,
    dto: AddClassTeacherDto,
  ): Promise<FullClassResponseDto> {
    return this.membershipService.addTeacher(classId, userId, dto);
  }

  /**
   * Remove a teacher from the class (only creator)
   */
  async removeTeacher(
    classId: string,
    userId: string,
    teacherId: string,
  ): Promise<FullClassResponseDto> {
    return this.membershipService.removeTeacher(classId, userId, teacherId);
  }

  /**
   * Join class by invite code
   */
  async joinClass(
    userId: string,
    inviteCode: string,
  ): Promise<FullClassResponseDto> {
    return this.membershipService.joinClass(userId, inviteCode);
  }

  /**
   * Leave class (student or teacher)
   */
  async leaveClass(classId: string, userId: string): Promise<boolean> {
    return this.membershipService.leaveClass(classId, userId);
  }

  /**
   * Remove student from class
   */
  async removeStudent(
    classId: string,
    userId: string,
    studentId: string,
  ): Promise<boolean> {
    return this.membershipService.removeStudent(classId, userId, studentId);
  }

  /**
   * Bulk add students
   */
  async bulkAddStudents(
    classId: string,
    userId: string,
    dto: BulkStudentIdsDto,
  ): Promise<UserSummaryDto[]> {
    return this.membershipService.bulkAddStudents(classId, userId, dto);
  }

  /**
   * Bulk remove students
   */
  async bulkRemoveStudents(
    classId: string,
    userId: string,
    dto: BulkStudentIdsDto,
  ): Promise<{ count: number }> {
    return this.membershipService.bulkRemoveStudents(classId, userId, dto);
  }
}
