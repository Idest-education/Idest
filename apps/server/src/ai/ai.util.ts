export function isVietnamesePrompt(prompt: string): boolean {
  const vietnamesePattern =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

  const vietnameseWords =
    /\b(và|của|có|không|được|này|đó|cho|với|từ|trong|trên|về|sau|trước|nếu|như|khi|để|làm|thì|sẽ|đã|đang|bị|bởi|theo|qua|tại|đến|hay|hoặc|nhưng|mà|vì|nên|phải|cần|muốn|thích|biết|hiểu|học|dạy|sinh viên|học sinh|giáo viên|thầy|cô|lớp|môn|bài|kiểm tra|thi|điểm|nộp|làm bài)\b/i;

  return vietnamesePattern.test(prompt) || vietnameseWords.test(prompt);
}

export type PromptContext =
  | 'User'
  | 'Class'
  | 'Assignment'
  | 'Submission'
  | 'Others';

export function getContextCategoryWithRegex(prompt: string): PromptContext {
  const normalizedPrompt = prompt.toLowerCase().trim();
  const isVietnamese = isVietnamesePrompt(prompt);

  const patterns: Record<PromptContext, RegExp> = {
    User: isVietnamese
      ? /\b(user|student|profile|account|login|register|signup|authenticate|role|người dùng|sinh viên|học sinh|hồ sơ|tài khoản|đăng nhập|đăng ký|xác thực|quyền|vai trò|thông tin cá nhân)\b/i
      : /\b(user|student|profile|account|login|register|signup|authenticate|role)\b/i,

    Class: isVietnamese
      ? /\b(class|course|subject|lesson|classroom|schedule|timetable|enroll|curriculum|lớp|khóa học|môn học|bài học|phòng học|lịch học|thời khóa biểu|đăng ký|chương trình học|giáo trình)\b/i
      : /\b(class|course|subject|lesson|classroom|schedule|timetable|enroll|curriculum)\b/i,

    Assignment: isVietnamese
      ? /\b(assignment|homework|task|project|work|due|deadline|submit|upload|bài tập|nhiệm vụ|dự án|công việc|hạn nộp|thời hạn|nộp bài|tải lên|giao bài)\b/i
      : /\b(assignment|homework|task|project|work|due|deadline|submit|upload)\b/i,

    Submission: isVietnamese
      ? /\b(submit|submission|upload|turn.?in|hand.?in|deliver|file|document|nộp|nộp bài|tải lên|gửi|chuyển|tệp|tài liệu|bài làm)\b/i
      : /\b(submit|submission|upload|turn.?in|hand.?in|deliver|file|document)\b/i,

    Others: /(?:)/i,
  };

  for (const [category, pattern] of Object.entries(patterns)) {
    if (category !== 'Others' && pattern.test(normalizedPrompt)) {
      return category as PromptContext;
    }
  }

  return 'Others';
}


