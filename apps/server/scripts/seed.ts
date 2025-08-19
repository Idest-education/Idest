import { PrismaClient } from '@prisma/client';
import { Role } from '../src/common/enum/role.enum';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data in reverse dependency order
  console.log('🧹 Cleaning existing data...');
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.classMember.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  console.log('👥 Creating test users...');
  const teacher1 = await prisma.user.create({
    data: {
      id: 'teacher-001',
      full_name: 'Dr. Alice Smith',
      email: 'alice.smith@university.edu',
      role: Role.TEACHER,
      avatar_url:
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150',
      is_active: true,
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      id: 'teacher-002',
      full_name: 'Prof. Bob Johnson',
      email: 'bob.johnson@university.edu',
      role: Role.TEACHER,
      avatar_url:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      is_active: true,
    },
  });

  const student1 = await prisma.user.create({
    data: {
      id: 'student-001',
      full_name: 'Charlie Brown',
      email: 'charlie.brown@student.edu',
      role: Role.STUDENT,
      avatar_url:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      is_active: true,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      id: 'student-002',
      full_name: 'Diana Prince',
      email: 'diana.prince@student.edu',
      role: Role.STUDENT,
      avatar_url:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      is_active: true,
    },
  });

  const student3 = await prisma.user.create({
    data: {
      id: 'student-003',
      full_name: 'Eva Martinez',
      email: 'eva.martinez@student.edu',
      role: Role.STUDENT,
      avatar_url:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      is_active: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: 'admin-001',
      full_name: 'Frank Administrator',
      email: 'frank.admin@university.edu',
      role: Role.ADMIN,
      avatar_url:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
      is_active: true,
    },
  });

  console.log(`✅ Created ${6} test users`);

  // Create test classes
  console.log('🏫 Creating test classes...');
  const mathClass = await prisma.class.create({
    data: {
      id: 'class-math-101',
      name: 'Mathematics 101',
      slug: 'mathematics-101',
      description: 'Introduction to Calculus and Linear Algebra',
      is_group: true,
      invite_code: 'MATH101',
      schedule: {
        days: ['Monday', 'Wednesday', 'Friday'],
        time: '09:00',
        duration: 90,
        timezone: 'UTC',
      },
      created_by: teacher1.id,
    } as any,
  });

  const physicsClass = await prisma.class.create({
    data: {
      id: 'class-physics-201',
      name: 'Physics 201',
      slug: 'physics-201',
      description: 'Classical Mechanics and Thermodynamics',
      is_group: true,
      invite_code: 'PHYS201',
      schedule: {
        days: ['Tuesday', 'Thursday'],
        time: '14:00',
        duration: 120,
        timezone: 'UTC',
      },
      created_by: teacher2.id,
    } as any,
  });

  const tutorialClass = await prisma.class.create({
    data: {
      id: 'class-tutorial-001',
      name: 'Personal Tutoring Session',
      slug: 'personal-tutoring-session',
      description: 'One-on-one mathematics tutoring',
      is_group: false,
      invite_code: 'TUTOR001',
      schedule: {
        days: ['Saturday'],
        time: '10:00',
        duration: 60,
        timezone: 'UTC',
      },
      created_by: teacher1.id,
    } as any,
  });

  console.log(`✅ Created ${3} test classes`);

  // Add class members
  console.log('👨‍🎓 Adding students to classes...');
  await prisma.classMember.createMany({
    data: [
      // Math class students
      { class_id: mathClass.id, student_id: student1.id, status: 'active' },
      { class_id: mathClass.id, student_id: student2.id, status: 'active' },
      { class_id: mathClass.id, student_id: student3.id, status: 'active' },

      // Physics class students
      { class_id: physicsClass.id, student_id: student1.id, status: 'active' },
      { class_id: physicsClass.id, student_id: student3.id, status: 'active' },

      // Tutorial class student
      { class_id: tutorialClass.id, student_id: student2.id, status: 'active' },
    ],
  });

  // Add class teachers
  await prisma.classTeacher.createMany({
    data: [
      { class_id: physicsClass.id, teacher_id: teacher1.id, role: 'assistant' },
    ],
  });

  console.log('✅ Added class memberships');

  // Create test sessions
  console.log('📅 Creating test sessions...');
  const now = new Date();
  const futureDate1 = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  const futureDate2 = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now
  const pastDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

  const currentMathSession = await prisma.session.create({
    data: {
      id: 'session-math-current',
      class_id: mathClass.id,
      host_id: teacher1.id,
      start_time: now,
      end_time: null, // Active session
      is_recorded: true,
      metadata: {
        topic: 'Derivatives and Integration',
        recording_quality: 'HD',
      },
    },
  });

  const upcomingPhysicsSession = await prisma.session.create({
    data: {
      id: 'session-physics-upcoming',
      class_id: physicsClass.id,
      host_id: teacher2.id,
      start_time: futureDate1,
      end_time: new Date(futureDate1.getTime() + 2 * 60 * 60 * 1000),
      is_recorded: false,
      metadata: {
        topic: "Newton's Laws of Motion",
      },
    },
  });

  const futureTutorialSession = await prisma.session.create({
    data: {
      id: 'session-tutorial-future',
      class_id: tutorialClass.id,
      host_id: teacher1.id,
      start_time: futureDate2,
      end_time: new Date(futureDate2.getTime() + 60 * 60 * 1000),
      is_recorded: false,
      metadata: {
        topic: 'Calculus Review',
        private: true,
      },
    },
  });

  const pastMathSession = await prisma.session.create({
    data: {
      id: 'session-math-past',
      class_id: mathClass.id,
      host_id: teacher1.id,
      start_time: new Date(pastDate.getTime() - 60 * 60 * 1000),
      end_time: pastDate,
      is_recorded: true,
      recording_url: 'https://example.com/recordings/math-session-1',
      metadata: {
        topic: 'Introduction to Limits',
        attendance: 3,
      },
    },
  });

  console.log(`✅ Created ${4} test sessions`);

  // Create test conversations
  console.log('💬 Creating test conversations...');

  // Direct conversation between teacher and student
  const directConversation = await prisma.conversation.create({
    data: {
      id: 'conv-direct-001',
      isGroup: false,
      createdBy: teacher1.id,
      ownerId: teacher1.id,
    } as any,
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: directConversation.id, userId: teacher1.id },
      { conversationId: directConversation.id, userId: student1.id },
    ],
  });

  // Group conversation for study group
  const groupConversation = await prisma.conversation.create({
    data: {
      id: 'conv-group-001',
      isGroup: true,
      title: 'Physics Study Group',
      createdBy: student1.id,
      ownerId: student1.id,
    } as any,
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: groupConversation.id, userId: student1.id },
      { conversationId: groupConversation.id, userId: student2.id },
      { conversationId: groupConversation.id, userId: student3.id },
    ],
  });

  console.log(`✅ Created ${2} test conversations`);

  // Create test messages
  console.log('📝 Creating test messages...');

  // Messages in direct conversation
  await prisma.message.createMany({
    data: [
      {
        content:
          'Hi Charlie! I noticed you had some questions about the last lecture.',
        senderId: teacher1.id,
        conversationId: directConversation.id,
        type: 'DIRECT',
        sentAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        content: "Yes, Dr. Smith! I'm struggling with the concept of limits.",
        senderId: student1.id,
        conversationId: directConversation.id,
        type: 'DIRECT',
        sentAt: new Date(now.getTime() - 50 * 60 * 1000), // 50 minutes ago
      },
      {
        content: 'No problem! Would you like to schedule a tutoring session?',
        senderId: teacher1.id,
        conversationId: directConversation.id,
        type: 'DIRECT',
        sentAt: new Date(now.getTime() - 45 * 60 * 1000), // 45 minutes ago
      },
    ],
  });

  // Messages in group conversation
  await prisma.message.createMany({
    data: [
      {
        content: "Hey everyone! Did you understand today's physics lecture?",
        senderId: student1.id,
        conversationId: groupConversation.id,
        type: 'DIRECT',
        sentAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
      },
      {
        content: 'I found the part about momentum conservation confusing.',
        senderId: student2.id,
        conversationId: groupConversation.id,
        type: 'DIRECT',
        sentAt: new Date(now.getTime() - 25 * 60 * 1000), // 25 minutes ago
      },
      {
        content: 'Same here! Maybe we should form a study group?',
        senderId: student3.id,
        conversationId: groupConversation.id,
        type: 'DIRECT',
        sentAt: new Date(now.getTime() - 20 * 60 * 1000), // 20 minutes ago
      },
      {
        content: "Great idea! Let's meet tomorrow in the library.",
        senderId: student1.id,
        conversationId: groupConversation.id,
        type: 'DIRECT',
        sentAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
      },
    ],
  });

  // Messages in current math session (meeting chat)
  await prisma.message.createMany({
    data: [
      {
        content: "Welcome everyone to today's calculus session!",
        senderId: teacher1.id,
        sessionId: currentMathSession.id,
        type: 'MEETING',
        sentAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
      },
      {
        content: 'Thank you, Dr. Smith! Excited to learn about derivatives.',
        senderId: student1.id,
        sessionId: currentMathSession.id,
        type: 'MEETING',
        sentAt: new Date(now.getTime() - 14 * 60 * 1000), // 14 minutes ago
      },
      {
        content: 'Can you please repeat the definition of a limit?',
        senderId: student2.id,
        sessionId: currentMathSession.id,
        type: 'MEETING',
        sentAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 minutes ago
      },
    ],
  });

  // Messages in math class (classroom chat)
  await prisma.message.createMany({
    data: [
      {
        content: 'Reminder: Assignment 3 is due next Friday!',
        senderId: teacher1.id,
        classId: mathClass.id,
        type: 'CLASSROOM',
        sentAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        content: 'Dr. Smith, will there be office hours this week?',
        senderId: student3.id,
        classId: mathClass.id,
        type: 'CLASSROOM',
        sentAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
      },
      {
        content: 'Yes! Office hours are Tuesday and Thursday 2-4 PM.',
        senderId: teacher1.id,
        classId: mathClass.id,
        type: 'CLASSROOM',
        sentAt: new Date(now.getTime() - 11 * 60 * 60 * 1000), // 11 hours ago
      },
    ],
  });

  console.log(`✅ Created test messages for all conversation types`);

  // Print summary
  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   👥 Users: 6 (2 teachers, 3 students, 1 admin)`);
  console.log(`   🏫 Classes: 3 (with proper enrollment)`);
  console.log(
    `   📅 Sessions: 4 (1 active, 1 upcoming, 1 future, 1 completed)`,
  );
  console.log(`   💬 Conversations: 2 (1 direct, 1 group)`);
  console.log(
    `   📝 Messages: Multiple across all types (DIRECT, MEETING, CLASSROOM)`,
  );

  console.log('\n🔑 Test Data for Meet Gateway:');
  console.log(`   📍 Active Session ID: ${currentMathSession.id}`);
  console.log(`   🎓 Math Class ID: ${mathClass.id}`);
  console.log(`   👨‍🏫 Teacher 1 ID: ${teacher1.id}`);
  console.log(`   👨‍🎓 Student 1 ID: ${student1.id}`);

  console.log('\n📱 Ready to test WebSocket connections!');
  console.log('   Connect to: ws://localhost:3002/meet');
  console.log(`   Use session: ${currentMathSession.id}`);
  console.log(`   Use any user token from the created users`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
