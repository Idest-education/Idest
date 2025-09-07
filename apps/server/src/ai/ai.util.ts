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
  | 'Question/Test'
  | 'Feedback'
  | 'Progress'
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

    'Question/Test': isVietnamese
      ? /\b(question|test|quiz|exam|assessment|evaluate|answer|score|grade|mark|câu hỏi|bài kiểm tra|bài thi|kỳ thi|đánh giá|chấm điểm|trả lời|điểm số|điểm|xếp loại)\b/i
      : /\b(question|test|quiz|exam|assessment|evaluate|answer|score|grade|mark)\b/i,

    Feedback: isVietnamese
      ? /\b(feedback|comment|review|rating|evaluation|critique|suggestion|improvement|phản hồi|bình luận|đánh giá|nhận xét|góp ý|đề xuất|cải thiện|ý kiến)\b/i
      : /\b(feedback|comment|review|rating|evaluation|critique|suggestion|improvement)\b/i,

    Progress: isVietnamese
      ? /\b(progress|tracking|status|completion|percentage|finished|started|ongoing|tiến độ|theo dõi|trạng thái|hoàn thành|phần trăm|kết thúc|bắt đầu|đang thực hiện|quá trình)\b/i
      : /\b(progress|tracking|status|completion|percentage|finished|started|ongoing)\b/i,

    Others: /(?:)/i,
  };

  for (const [category, pattern] of Object.entries(patterns)) {
    if (category !== 'Others' && pattern.test(normalizedPrompt)) {
      return category as PromptContext;
    }
  }

  return 'Others';
}


