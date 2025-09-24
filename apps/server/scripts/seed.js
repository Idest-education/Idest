"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const supabase_service_1 = require("../src/supabase/supabase.service");
const user_service_1 = require("../src/user/user.service");
const class_service_1 = require("../src/class/class.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
const role_enum_1 = require("../src/common/enum/role.enum");
const specialization_enum_1 = require("../src/common/enum/specialization.enum");
async function createSupabaseAccounts(supabaseService) {
    console.log('- Creating Supabase accounts...');
    const students = [];
    for (let i = 1; i <= 10; i++) {
        const email = `example${i.toString().padStart(2, '0')}@example.com`;
        const fullName = `Student ${i}`;
        try {
            console.log(`Creating account for ${email}...`);
            const { data: authData, error: authError } = await supabaseService.authAdmin.createUser({
                email,
                password: 'example123',
                email_confirm: true,
                user_metadata: {
                    full_name: fullName,
                    role: role_enum_1.Role.STUDENT,
                },
            });
            if (authError) {
                console.error(`X Failed to create Supabase account for ${email}:`, authError.message);
                continue;
            }
            if (!authData.user) {
                console.error(`X No user data returned for ${email}`);
                continue;
            }
            const targetScore = Math.round((Math.random() * 3.5 + 5) * 10) / 10;
            const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
            const currentLevel = levels[Math.floor(Math.random() * levels.length)];
            students.push({
                email,
                fullName,
                supabaseUserId: authData.user.id,
                targetScore,
                currentLevel,
            });
            console.log(`- Created Supabase account for ${email} (ID: ${authData.user.id})`);
        }
        catch (error) {
            console.error(`X Error creating account for ${email}:`, error);
        }
    }
    console.log(`- Created ${students.length} Supabase accounts`);
    return students;
}
async function createTeacherAccounts(supabaseService) {
    console.log('- Creating teacher Supabase accounts...');
    const teachers = [];
    for (let i = 11; i <= 12; i++) {
        const email = `example${i}@example.com`;
        const fullName = `Teacher ${i - 10}`;
        try {
            console.log(`Creating teacher account for ${email}...`);
            const { data: authData, error: authError } = await supabaseService.authAdmin.createUser({
                email,
                password: 'example123',
                email_confirm: true,
                user_metadata: {
                    full_name: fullName,
                    role: role_enum_1.Role.TEACHER,
                },
            });
            if (authError) {
                console.error(`X Failed to create teacher Supabase account for ${email}:`, authError.message);
                continue;
            }
            if (!authData.user) {
                console.error(`X No user data returned for ${email}`);
                continue;
            }
            const allSpecializations = Object.values(specialization_enum_1.Specialization);
            const specializationCount = Math.floor(Math.random() * 3) + 1;
            const specialization = allSpecializations
                .sort(() => 0.5 - Math.random())
                .slice(0, specializationCount);
            const degrees = [
                'Master of Education',
                'Master of Arts in English',
                'Bachelor of Education',
                'PhD in Linguistics',
                'Master of Applied Linguistics',
            ];
            const degree = degrees[Math.floor(Math.random() * degrees.length)];
            const bios = [
                'Experienced IELTS instructor with 10+ years of teaching experience.',
                'Professional English teacher specializing in test preparation.',
                'Certified IELTS trainer with extensive experience in all four skills.',
                'Expert in English language teaching with focus on academic preparation.',
                'Dedicated educator with proven track record in IELTS success.',
            ];
            const bio = bios[Math.floor(Math.random() * bios.length)];
            teachers.push({
                email,
                fullName,
                supabaseUserId: authData.user.id,
                degree,
                specialization,
                bio,
            });
            console.log(`- Created teacher Supabase account for ${email} (ID: ${authData.user.id})`);
        }
        catch (error) {
            console.error(`X Error creating teacher account for ${email}:`, error);
        }
    }
    console.log(`- Created ${teachers.length} teacher Supabase accounts`);
    return teachers;
}
async function createUsers(userService, students) {
    console.log('- Creating User records...');
    const userIds = [];
    for (const student of students) {
        try {
            console.log(`Creating user record for ${student.email}...`);
            const userPayload = {
                id: student.supabaseUserId,
                full_name: student.fullName,
                email: student.email,
                role: role_enum_1.Role.STUDENT,
                avatar: '',
            };
            await userService.createUser(userPayload);
            userIds.push(student.supabaseUserId);
            console.log(`- Created user record for ${student.email}`);
        }
        catch (error) {
            console.error(`X Error creating user record for ${student.email}:`, error);
        }
    }
    console.log(`- Created ${userIds.length} User records`);
    return userIds;
}
async function createTeacherUsers(userService, teachers) {
    console.log('- Creating Teacher User records...');
    const teacherIds = [];
    for (const teacher of teachers) {
        try {
            console.log(`Creating teacher user record for ${teacher.email}...`);
            const userPayload = {
                id: teacher.supabaseUserId,
                full_name: teacher.fullName,
                email: teacher.email,
                role: role_enum_1.Role.TEACHER,
                avatar: '',
            };
            await userService.createUser(userPayload);
            teacherIds.push(teacher.supabaseUserId);
            console.log(`- Created teacher user record for ${teacher.email}`);
        }
        catch (error) {
            console.error(`X Error creating teacher user record for ${teacher.email}:`, error);
        }
    }
    console.log(`- Created ${teacherIds.length} Teacher User records`);
    return teacherIds;
}
async function createStudentProfiles(userService, students) {
    console.log('- Creating StudentProfile records...');
    for (const student of students) {
        try {
            console.log(`Creating student profile for ${student.email}...`);
            const userPayload = {
                id: student.supabaseUserId,
                full_name: student.fullName,
                email: student.email,
                role: role_enum_1.Role.STUDENT,
                avatar: '',
            };
            const studentProfileDto = {
                target_score: student.targetScore,
                current_level: student.currentLevel,
            };
            await userService.createStudentProfile(userPayload, studentProfileDto);
            console.log(`- Created student profile for ${student.email} (Target: ${student.targetScore}, Level: ${student.currentLevel})`);
        }
        catch (error) {
            console.error(`X Error creating student profile for ${student.email}:`, error);
        }
    }
    console.log(`- Created ${students.length} StudentProfile records`);
}
async function createTeacherProfiles(userService, teachers) {
    console.log('- Creating TeacherProfile records...');
    for (const teacher of teachers) {
        try {
            console.log(`Creating teacher profile for ${teacher.email}...`);
            const teacherProfileDto = {
                email: teacher.email,
                fullName: teacher.fullName,
                degree: teacher.degree,
                specialization: teacher.specialization,
                bio: teacher.bio,
                avatar: '',
            };
            await userService.createTeacherProfileWithAccountId(teacher.supabaseUserId, teacherProfileDto);
            console.log(`- Created teacher profile for ${teacher.email} (Degree: ${teacher.degree}, Specializations: ${teacher.specialization.join(', ')})`);
        }
        catch (error) {
            console.error(`X Error creating teacher profile for ${teacher.email}:`, error);
        }
    }
    console.log(`- Created ${teachers.length} TeacherProfile records`);
}
async function createClasses(classService, prismaService, teacherIds) {
    console.log('- Creating classes...');
    const classes = [];
    const students = await prismaService.user.findMany({
        where: { role: role_enum_1.Role.STUDENT },
        select: { id: true },
    });
    const studentIds = students.map((s) => s.id);
    if (studentIds.length < 10) {
        throw new Error(`Expected 10 students, found ${studentIds.length}`);
    }
    const firstGroup = studentIds.slice(0, 5);
    const secondGroup = studentIds.slice(5, 10);
    if (teacherIds.length < 2) {
        throw new Error('Need at least 2 teachers to create 2 classes');
    }
    const teachers = await prismaService.user.findMany({
        where: { id: { in: teacherIds } },
    });
    if (teachers.length < 2) {
        throw new Error('Not enough teachers found in database?');
    }
    const firstTeacher = teachers[0];
    const secondTeacher = teachers[1];
    const firstTeacherPayload = {
        id: firstTeacher.id,
        full_name: firstTeacher.full_name,
        email: firstTeacher.email,
        role: firstTeacher.role,
        avatar: firstTeacher.avatar_url || '',
    };
    const secondTeacherPayload = {
        id: secondTeacher.id,
        full_name: secondTeacher.full_name,
        email: secondTeacher.email,
        role: secondTeacher.role,
        avatar: secondTeacher.avatar_url || '',
    };
    try {
        console.log('Creating Pre IELTS Q4 2025 class...');
        const preIeltsClass = await classService.createClass(firstTeacherPayload, {
            name: 'Pre IELTS Q4 2025',
            description: 'Pre-intermediate IELTS preparation course for Q4 2025. This class focuses on building foundational English skills and introducing IELTS test format.',
            is_group: true,
            schedule: {
                days: ['monday', 'wednesday', 'friday'],
                time: '10:00',
                duration: 90,
                timezone: 'UTC',
                recurring: true,
            },
            invite_code: 'PREIELTS2025',
        });
        classes.push({
            name: preIeltsClass.name || 'Pre IELTS Q4 2025',
            description: preIeltsClass.description ||
                'Pre-intermediate IELTS preparation course',
            studentIds: firstGroup,
            teacherId: firstTeacher.id,
        });
        console.log(`- Created Pre IELTS class (ID: ${preIeltsClass.id || 'unknown'})`);
    }
    catch (error) {
        console.error('X Error creating Pre IELTS class:', error);
    }
    try {
        console.log('Creating Intermediate IELTS Q4 2025 class...');
        const intermediateIeltsClass = await classService.createClass(secondTeacherPayload, {
            name: 'Intermediate IELTS Q4 2025',
            description: 'Intermediate IELTS preparation course for Q4 2025. This class focuses on intermediate-level English skills and advanced IELTS test strategies.',
            is_group: true,
            schedule: {
                days: ['tuesday', 'thursday', 'saturday'],
                time: '14:00',
                duration: 90,
                timezone: 'UTC',
                recurring: true,
            },
            invite_code: 'INTIELTS2025',
        });
        classes.push({
            name: intermediateIeltsClass.name || 'Intermediate IELTS Q4 2025',
            description: intermediateIeltsClass.description ||
                'Intermediate IELTS preparation course',
            studentIds: secondGroup,
            teacherId: secondTeacher.id,
        });
        console.log(`- Created Intermediate IELTS class (ID: ${intermediateIeltsClass.id || 'unknown'})`);
    }
    catch (error) {
        console.error('X Error creating Intermediate IELTS class:', error);
    }
    console.log(`- Created ${classes.length} classes`);
    return classes;
}
async function assignStudentsAndTeachersToClasses(classService, prismaService, classes) {
    console.log('- Assigning students and teachers to classes...');
    for (const classData of classes) {
        try {
            const classRecord = await prismaService.class.findFirst({
                where: { name: classData.name },
            });
            if (!classRecord) {
                console.error(`X Class not found: ${classData.name}`);
                continue;
            }
            console.log(`Assigning students and teachers to ${classData.name}...`);
            try {
                await classService.addTeacher(classRecord.id, classData.teacherId, {
                    teacher_id: classData.teacherId,
                    role: 'TEACHER',
                });
                console.log(`- Added teacher ${classData.teacherId} to ${classData.name}`);
            }
            catch (error) {
                console.error(`X Error adding teacher ${classData.teacherId} to ${classData.name}:`, error);
            }
            for (const studentId of classData.studentIds) {
                try {
                    await classService.addStudent(classRecord.id, classData.teacherId, {
                        student_id: studentId,
                    });
                    console.log(`- Added student ${studentId} to ${classData.name}`);
                }
                catch (error) {
                    console.error(`X Error adding student ${studentId} to ${classData.name}:`, error);
                }
            }
        }
        catch (error) {
            console.error(`X Error processing class ${classData.name}:`, error);
        }
    }
    console.log('- Finished assigning students and teachers to classes');
}
async function main() {
    console.log('- Starting database seeding...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const supabaseService = app.get(supabase_service_1.SupabaseService);
    const userService = app.get(user_service_1.UserService);
    const classService = app.get(class_service_1.ClassService);
    const prismaService = app.get(prisma_service_1.PrismaService);
    try {
        const students = await createSupabaseAccounts(supabaseService);
        if (students.length === 0) {
            throw new Error('No students created. Aborting seeding process.');
        }
        const teachers = await createTeacherAccounts(supabaseService);
        if (teachers.length === 0) {
            throw new Error('No teachers created. Aborting seeding process.');
        }
        const userIds = await createUsers(userService, students);
        if (userIds.length === 0) {
            throw new Error('No users created. Aborting seeding process.');
        }
        const teacherUserIds = await createTeacherUsers(userService, teachers);
        if (teacherUserIds.length === 0) {
            throw new Error('No teacher users created. Aborting seeding process.');
        }
        await createStudentProfiles(userService, students);
        await createTeacherProfiles(userService, teachers);
        const classes = await createClasses(classService, prismaService, teacherUserIds);
        if (classes.length === 0) {
            throw new Error('No classes created. Aborting seeding process.');
        }
        await assignStudentsAndTeachersToClasses(classService, prismaService, classes);
        console.log('Database seeding completed successfully!');
        console.log(`!Summary:`);
        console.log(`   - Created ${students.length} student Supabase accounts`);
        console.log(`   - Created ${teachers.length} teacher Supabase accounts`);
        console.log(`   - Created ${userIds.length} student User records`);
        console.log(`   - Created ${teacherUserIds.length} teacher User records`);
        console.log(`   - Created ${students.length} StudentProfile records`);
        console.log(`   - Created ${teachers.length} TeacherProfile records`);
        console.log(`   - Created ${classes.length} classes`);
        console.log(`   - Assigned teachers and students to classes`);
    }
    catch (error) {
        console.error('X Seeding failed:', error);
        process.exit(1);
    }
    finally {
        await app.close();
    }
}
main();
//# sourceMappingURL=seed.js.map