import {
  slugify,
  checkClassAccess,
  mapUsersToDto,
  toFullClassResponseDto,
  generateUniqueInviteCode,
  generateUniqueSlug,
  checkClassManagementPermission,
  checkClassAccessById,
} from './class.util';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips special characters', () => {
    expect(slugify('Class #101!')).toBe('class-101');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(slugify('  multiple   spaces  ')).toBe('multiple-spaces');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('-leading-trailing-')).toBe('leading-trailing');
  });

  it('handles an already-valid slug', () => {
    expect(slugify('already-fine')).toBe('already-fine');
  });

  it('returns empty string for blank input', () => {
    expect(slugify('   ')).toBe('');
  });
});

describe('checkClassAccess', () => {
  const makeClass = (overrides = {}) => ({
    created_by: 'creator-id',
    teachers: [],
    members: [],
    ...overrides,
  });

  it('grants access to the creator', () => {
    expect(checkClassAccess(makeClass(), 'creator-id')).toBe(true);
  });

  it('grants access to a teacher', () => {
    const cls = makeClass({ teachers: [{ teacher_id: 'teacher-1' }] });
    expect(checkClassAccess(cls, 'teacher-1')).toBe(true);
  });

  it('grants access to an active student', () => {
    const cls = makeClass({
      members: [{ student_id: 'student-1', status: 'active' }],
    });
    expect(checkClassAccess(cls, 'student-1')).toBe(true);
  });

  it('denies access to an inactive student', () => {
    const cls = makeClass({
      members: [{ student_id: 'student-1', status: 'inactive' }],
    });
    expect(checkClassAccess(cls, 'student-1')).toBe(false);
  });

  it('denies access to an unrelated user', () => {
    expect(checkClassAccess(makeClass(), 'stranger')).toBe(false);
  });
});

describe('mapUsersToDto', () => {
  it('maps student relations correctly', () => {
    const relations = [
      {
        student: {
          id: 's1',
          full_name: 'Alice',
          email: 'alice@test.com',
          avatar_url: null,
          role: 'STUDENT',
        },
      },
    ];
    const result = mapUsersToDto(relations);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 's1',
      full_name: 'Alice',
      email: 'alice@test.com',
      role: 'STUDENT',
    });
  });

  it('maps teacher relations correctly', () => {
    const relations = [
      {
        teacher: {
          id: 't1',
          full_name: 'Bob',
          email: 'bob@test.com',
          avatar_url: 'http://img',
          role: 'TEACHER',
        },
      },
    ];
    const result = mapUsersToDto(relations);
    expect(result[0].id).toBe('t1');
    expect(result[0].avatar_url).toBe('http://img');
  });

  it('returns empty array for empty input', () => {
    expect(mapUsersToDto([])).toEqual([]);
  });
});

describe('toFullClassResponseDto', () => {
  const makeClassData = () => ({
    id: 'class-1',
    name: 'English 101',
    slug: 'english-101',
    description: 'A class',
    is_group: true,
    price: null,
    invite_code: 'ABCD1234',
    created_by: 'creator-id',
    schedule: null,
    creator: {
      id: 'creator-id',
      full_name: 'Teacher T',
      email: 'teacher@test.com',
      role: 'TEACHER',
      avatar_url: null,
    },
    _count: { members: 1, teachers: 1, sessions: 2 },
    members: [
      {
        student: {
          id: 's1',
          full_name: 'Alice',
          email: 'alice@test.com',
          avatar_url: null,
          role: 'STUDENT',
        },
      },
    ],
    teachers: [
      {
        teacher: {
          id: 't1',
          full_name: 'Bob',
          email: 'bob@test.com',
          avatar_url: null,
          role: 'TEACHER',
        },
      },
    ],
    sessions: [
      {
        id: 'sess-1',
        start_time: new Date('2025-01-01'),
        end_time: null,
        host: { id: 'h1', full_name: 'Host', email: 'host@test.com' },
      },
    ],
  });

  it('maps all fields correctly', () => {
    const result = toFullClassResponseDto(makeClassData());
    expect(result.id).toBe('class-1');
    expect(result.name).toBe('English 101');
    expect(result.members).toHaveLength(1);
    expect(result.members[0].id).toBe('s1');
    expect(result.teachers).toHaveLength(1);
    expect(result.teachers[0].id).toBe('t1');
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].id).toBe('sess-1');
    expect(result._count).toEqual({ members: 1, teachers: 1, sessions: 2 });
  });

  it('defaults description and price to null when missing', () => {
    const data = { ...makeClassData(), description: undefined, price: undefined };
    const result = toFullClassResponseDto(data);
    expect(result.description).toBeNull();
    expect(result.price).toBeNull();
  });
});

describe('generateUniqueInviteCode', () => {
  it('returns an 8-character alphanumeric code when no collision', async () => {
    const prisma = { class: { findUnique: jest.fn().mockResolvedValue(null) } };
    const code = await generateUniqueInviteCode(prisma);
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('retries until a unique code is found', async () => {
    let calls = 0;
    const prisma = {
      class: {
        findUnique: jest.fn().mockImplementation(() => {
          calls += 1;
          // First 2 calls return a collision, third is free
          return Promise.resolve(calls < 3 ? { id: 'existing' } : null);
        }),
      },
    };
    const code = await generateUniqueInviteCode(prisma);
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    expect(calls).toBe(3);
  });
});

describe('generateUniqueSlug', () => {
  it('returns base slug when no collision', async () => {
    const prisma = { class: { findFirst: jest.fn().mockResolvedValue(null) } };
    const slug = await generateUniqueSlug('Hello World', prisma);
    expect(slug).toBe('hello-world');
  });

  it('appends incrementing number on collision', async () => {
    let calls = 0;
    const prisma = {
      class: {
        findFirst: jest.fn().mockImplementation(() => {
          calls += 1;
          return Promise.resolve(calls === 1 ? { id: 'taken' } : null);
        }),
      },
    };
    const slug = await generateUniqueSlug('Hello World', prisma);
    expect(slug).toBe('hello-world-2');
  });
});

describe('checkClassManagementPermission', () => {
  it('returns true for creator', async () => {
    const prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue({
          created_by: 'user-1',
          teachers: [],
        }),
      },
    };
    const result = await checkClassManagementPermission('class-1', 'user-1', prisma);
    expect(result).toBe(true);
  });

  it('returns true for a teacher', async () => {
    const prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue({
          created_by: 'creator',
          teachers: [{ teacher_id: 'teacher-1' }],
        }),
      },
    };
    const result = await checkClassManagementPermission('class-1', 'teacher-1', prisma);
    expect(result).toBe(true);
  });

  it('returns false for a regular member', async () => {
    const prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue({
          created_by: 'creator',
          teachers: [],
        }),
      },
    };
    const result = await checkClassManagementPermission('class-1', 'student', prisma);
    expect(result).toBe(false);
  });

  it('returns false when class does not exist', async () => {
    const prisma = { class: { findUnique: jest.fn().mockResolvedValue(null) } };
    const result = await checkClassManagementPermission('bad-id', 'anyone', prisma);
    expect(result).toBe(false);
  });
});

describe('checkClassAccessById', () => {
  it('returns true when user has access', async () => {
    const prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue({
          created_by: 'user-1',
          teachers: [],
          members: [],
        }),
      },
    };
    const result = await checkClassAccessById('class-1', 'user-1', prisma);
    expect(result).toBe(true);
  });

  it('returns false when class is not found', async () => {
    const prisma = { class: { findUnique: jest.fn().mockResolvedValue(null) } };
    const result = await checkClassAccessById('bad-id', 'user-1', prisma);
    expect(result).toBe(false);
  });
});
