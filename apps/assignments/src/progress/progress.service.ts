import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ReadingSubmission, ReadingSubmissionDocument } from '../assignment/schemas/reading-submission.schema';
import { ListeningSubmission, ListeningSubmissionDocument } from '../assignment/schemas/listening-submission.schema';
import { WritingSubmission, WritingSubmissionDocument } from '../assignment/writing/schemas/writing-submission.schema';
import { SpeakingSubmission, SpeakingSubmissionDocument } from '../assignment/speaking/schemas/speaking-submission.schema';
import { ReadingAssignment, ReadingAssignmentDocument } from '../assignment/schemas/reading-assignment.schema';
import { ListeningAssignment, ListeningAssignmentDocument } from '../assignment/schemas/listening-assignment.schema';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(ReadingSubmission.name)
    private readonly readingSubmissionModel: Model<ReadingSubmissionDocument>,
    @InjectModel(ListeningSubmission.name)
    private readonly listeningSubmissionModel: Model<ListeningSubmissionDocument>,
    @InjectModel(WritingSubmission.name)
    private readonly writingSubmissionModel: Model<WritingSubmissionDocument>,
    @InjectModel(SpeakingSubmission.name)
    private readonly speakingSubmissionModel: Model<SpeakingSubmissionDocument>,
    @InjectModel(ReadingAssignment.name)
    private readonly readingAssignmentModel: Model<ReadingAssignmentDocument>,
    @InjectModel(ListeningAssignment.name)
    private readonly listeningAssignmentModel: Model<ListeningAssignmentDocument>,
  ) {}

  private getDateRange(window: string): { start: Date; end: Date } {
    const now = new Date();
    let start = new Date(0); // 'all' default

    if (window === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (window === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (window === '90d') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    return { start, end: now };
  }

  private getPreviousDateRange(window: string, currentStart: Date): { start: Date; end: Date } | null {
    if (window === 'all') return null;
    const now = new Date();
    const duration = now.getTime() - currentStart.getTime();
    const start = new Date(currentStart.getTime() - duration);
    return { start, end: currentStart };
  }

  async getTimeline(
    userId: string,
    skill: 'reading' | 'listening' | 'writing' | 'speaking' | 'overall',
    window: '7d' | '30d' | '90d' | 'all',
  ) {
    const { start: currentStart, end: currentEnd } = this.getDateRange(window);

    // Fetch all submissions for the user to support rolling average and trend calculations
    let submissions: Array<{ created_at: Date; score: number; _id: string; skill: string; assignment_id: string }> = [];

    if (skill === 'reading' || skill === 'overall') {
      const subs = await this.readingSubmissionModel
        .find({ submitted_by: userId, score: { $ne: null } })
        .lean()
        .exec();
      submissions = submissions.concat(
        subs.map((s) => ({
          created_at: new Date((s as any).created_at || (s as any).createdAt),
          score: s.score,
          _id: s._id.toString(),
          skill: 'reading',
          assignment_id: s.assignment_id,
        })),
      );
    }

    if (skill === 'listening' || skill === 'overall') {
      const subs = await this.listeningSubmissionModel
        .find({ submitted_by: userId, score: { $ne: null } })
        .lean()
        .exec();
      submissions = submissions.concat(
        subs.map((s) => ({
          created_at: new Date((s as any).created_at || (s as any).createdAt),
          score: s.score,
          _id: s._id.toString(),
          skill: 'listening',
          assignment_id: s.assignment_id,
        })),
      );
    }

    if (skill === 'writing' || skill === 'overall') {
      const subs = await this.writingSubmissionModel
        .find({ user_id: userId, status: 'graded', score: { $ne: null } })
        .lean()
        .exec();
      submissions = submissions.concat(
        subs.map((s) => ({
          created_at: new Date((s as any).created_at || (s as any).createdAt),
          score: s.score!,
          _id: s._id.toString(),
          skill: 'writing',
          assignment_id: s.assignment_id,
        })),
      );
    }

    if (skill === 'speaking' || skill === 'overall') {
      const subs = await this.speakingSubmissionModel
        .find({ user_id: userId, status: 'graded', score: { $ne: null } })
        .lean()
        .exec();
      submissions = submissions.concat(
        subs.map((s) => ({
          created_at: new Date((s as any).created_at || (s as any).createdAt),
          score: s.score!,
          _id: s._id.toString(),
          skill: 'speaking',
          assignment_id: s.assignment_id,
        })),
      );
    }

    // Sort all chronologically ascending for points list
    submissions.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    // Current window points
    const pointsInWindow = submissions.filter(
      (s) => s.created_at.getTime() >= currentStart.getTime() && s.created_at.getTime() <= currentEnd.getTime(),
    );

    const points = pointsInWindow.map((s) => ({
      timestamp: s.created_at.toISOString(),
      score: s.score,
      submissionId: s._id,
      assignmentId: s.assignment_id,
      skill: s.skill,
    }));

    // Rolling average of 5 most recent submissions
    let rollingAverage: number | null = null;
    const recentSubmissions = [...submissions]
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5);

    if (recentSubmissions.length > 0) {
      const sum = recentSubmissions.reduce((acc, s) => acc + s.score, 0);
      rollingAverage = Math.round((sum / recentSubmissions.length) * 100) / 100;
    }

    // Delta and Direction vs Previous Window
    let deltaVsPreviousWindow: number | null = null;
    let direction: 'up' | 'down' | 'flat' | 'unknown' = 'unknown';

    const prevRange = this.getPreviousDateRange(window, currentStart);
    if (prevRange) {
      const currentWindowSubs = pointsInWindow;
      const prevWindowSubs = submissions.filter(
        (s) => s.created_at.getTime() >= prevRange.start.getTime() && s.created_at.getTime() < prevRange.end.getTime(),
      );

      if (currentWindowSubs.length >= 2 && prevWindowSubs.length >= 2) {
        const currentSum = currentWindowSubs.reduce((acc, s) => acc + s.score, 0);
        const currentAvg = currentSum / currentWindowSubs.length;

        const prevSum = prevWindowSubs.reduce((acc, s) => acc + s.score, 0);
        const prevAvg = prevSum / prevWindowSubs.length;

        deltaVsPreviousWindow = Math.round((currentAvg - prevAvg) * 100) / 100;

        if (deltaVsPreviousWindow > 0) {
          direction = 'up';
        } else if (deltaVsPreviousWindow < 0) {
          direction = 'down';
        } else {
          direction = 'flat';
        }
      }
    }

    return {
      skill,
      window,
      points,
      trend: {
        rollingAverage,
        deltaVsPreviousWindow,
        direction,
      },
    };
  }

  async getQuestionTypes(
    userId: string,
    skill: 'reading' | 'listening',
    window: '7d' | '30d' | '90d' | 'all',
  ) {
    const { start: currentStart, end: currentEnd } = this.getDateRange(window);

    const submissionModel = skill === 'reading' ? this.readingSubmissionModel : this.listeningSubmissionModel;
    const assignmentModel = skill === 'reading' ? this.readingAssignmentModel : this.listeningAssignmentModel;

    // Fetch all submissions of the user
    const submissions = await submissionModel
      .find({ submitted_by: userId })
      .lean()
      .exec();

    // Map creation time correctly
    const mappedSubmissions = submissions.map((s) => ({
      ...s,
      created_at_date: new Date((s as any).created_at || (s as any).createdAt),
    }));

    // Current window submissions
    const currentWindowSubs = mappedSubmissions.filter(
      (s) => s.created_at_date.getTime() >= currentStart.getTime() && s.created_at_date.getTime() <= currentEnd.getTime(),
    );

    // Previous window submissions
    let prevWindowSubs: any[] = [];
    const prevRange = this.getPreviousDateRange(window, currentStart);
    if (prevRange) {
      prevWindowSubs = mappedSubmissions.filter(
        (s) => s.created_at_date.getTime() >= prevRange.start.getTime() && s.created_at_date.getTime() < prevRange.end.getTime(),
      );
    }

    // Get all unique assignment IDs across both windows
    const allAssignmentIds = Array.from(
      new Set([
        ...currentWindowSubs.map((s) => s.assignment_id),
        ...prevWindowSubs.map((s) => s.assignment_id),
      ]),
    );

    // Fetch assignments to resolve question types
    const assignments = await assignmentModel
      .find({ _id: { $in: allAssignmentIds } })
      .lean()
      .exec();

    // Create a map of question_id -> type
    const questionTypeMap = new Map<string, string>();
    for (const assignment of assignments) {
      for (const section of (assignment as any).sections || []) {
        for (const group of section.question_groups || []) {
          for (const q of group.questions || []) {
            if (q.id && q.type) {
              questionTypeMap.set(q.id, q.type);
            }
          }
        }
      }
    }

    // Helper to calculate stats per questionType
    const calculateStats = (subs: any[]) => {
      const stats = new Map<string, { correct: number; total: number }>();

      for (const sub of subs) {
        for (const section of sub.details || []) {
          for (const q of section.questions || []) {
            const type = questionTypeMap.get(q.question_id);
            if (!type) continue;

            if (!stats.has(type)) {
              stats.set(type, { correct: 0, total: 0 });
            }

            const currentStat = stats.get(type)!;

            if (q.parts && Array.isArray(q.parts) && q.parts.length > 0) {
              for (const part of q.parts) {
                currentStat.total += 1;
                if (part.correct) {
                  currentStat.correct += 1;
                }
              }
            } else {
              currentStat.total += 1;
              if (q.correct) {
                currentStat.correct += 1;
              }
            }
          }
        }
      }

      return stats;
    };

    const currentStats = calculateStats(currentWindowSubs);
    const prevStats = calculateStats(prevWindowSubs);

    const items: any[] = [];

    for (const [type, stat] of currentStats.entries()) {
      const accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) / 100 : 0;

      let confidence: 'high' | 'medium' | 'insufficient_data' = 'insufficient_data';
      if (stat.total >= 20) {
        confidence = 'high';
      } else if (stat.total >= 8) {
        confidence = 'medium';
      }

      let classification: 'strong' | 'weak' | 'neutral' | 'insufficient_data' = 'insufficient_data';
      if (confidence !== 'insufficient_data') {
        if (accuracy >= 0.8) {
          classification = 'strong';
        } else if (accuracy < 0.6) {
          classification = 'weak';
        } else {
          classification = 'neutral';
        }
      }

      let trendDirection: 'improving' | 'declining' | 'stable' | 'unknown' = 'unknown';
      const prevStat = prevStats.get(type);

      if (prevStat && prevStat.total > 0 && stat.total > 0) {
        const prevAccuracy = prevStat.correct / prevStat.total;
        const delta = accuracy - prevAccuracy;

        if (delta > 0.05) {
          trendDirection = 'improving';
        } else if (delta < -0.05) {
          trendDirection = 'declining';
        } else {
          trendDirection = 'stable';
        }
      }

      items.push({
        questionType: type,
        accuracy,
        correctItems: stat.correct,
        totalItems: stat.total,
        confidence,
        classification,
        trendDirection,
      });
    }

    return {
      skill,
      window,
      items,
    };
  }

  private getRubricScores(sub: any) {
    if (sub.rubric_scores) {
      return sub.rubric_scores;
    }

    // Fallback to extract from grading_breakdown
    const breakdown = sub.grading_breakdown;
    if (breakdown && breakdown.tasks) {
      const task1 = breakdown.tasks.task1;
      const task2 = breakdown.tasks.task2;

      if (task1 && task2 && task1.rubrics && task2.rubrics) {
        return {
          task_response: (parseFloat(task1.rubrics.task_achievement?.band || 0) + parseFloat(task2.rubrics.task_achievement?.band || 0)) / 2,
          coherence_cohesion: (parseFloat(task1.rubrics.coherence?.band || 0) + parseFloat(task2.rubrics.coherence?.band || 0)) / 2,
          lexical_resource: (parseFloat(task1.rubrics.lexical?.band || 0) + parseFloat(task2.rubrics.lexical?.band || 0)) / 2,
          grammar_range_accuracy: (parseFloat(task1.rubrics.grammar?.band || 0) + parseFloat(task2.rubrics.grammar?.band || 0)) / 2,
        };
      }
    }

    return null;
  }

  async getWritingRubrics(userId: string, window: '7d' | '30d' | '90d' | 'all') {
    const { start: currentStart, end: currentEnd } = this.getDateRange(window);

    const submissions = await this.writingSubmissionModel
      .find({ user_id: userId, status: 'graded' })
      .lean()
      .exec();

    const mappedSubmissions = submissions.map((s) => ({
      ...s,
      created_at_date: new Date((s as any).created_at || (s as any).createdAt),
      rubricScores: this.getRubricScores(s),
    }));

    const currentWindowSubs = mappedSubmissions.filter(
      (s) =>
        s.created_at_date.getTime() >= currentStart.getTime() &&
        s.created_at_date.getTime() <= currentEnd.getTime() &&
        s.rubricScores !== null,
    );

    let prevWindowSubs: any[] = [];
    const prevRange = this.getPreviousDateRange(window, currentStart);
    if (prevRange) {
      prevWindowSubs = mappedSubmissions.filter(
        (s) =>
          s.created_at_date.getTime() >= prevRange.start.getTime() &&
          s.created_at_date.getTime() < prevRange.end.getTime() &&
          s.rubricScores !== null,
      );
    }

    const criteriaKeys = [
      { key: 'task_response', label: 'task_response' },
      { key: 'coherence_cohesion', label: 'coherence_cohesion' },
      { key: 'lexical_resource', label: 'lexical_resource' },
      { key: 'grammar_range_accuracy', label: 'grammar_range_accuracy' },
    ];

    const getRecommendation = (key: string, averageBand: number | null) => {
      if (averageBand === null) return '';

      if (key === 'task_response') {
        if (averageBand >= 7.0) return 'Duy trì cấu trúc bài viết tốt, trả lời đầy đủ và sâu sắc tất cả các phần của đề bài.';
        if (averageBand >= 6.0) return 'Làm outline 4 đoạn trước khi viết; mỗi đoạn trả lời trực tiếp một phần đề.';
        return 'Tập trung phân tích kỹ câu hỏi, đảm bảo trả lời trực tiếp tất cả các yêu cầu của đề bài và không lạc đề.';
      }

      if (key === 'coherence_cohesion') {
        if (averageBand >= 7.0) return 'Giữ văn phong mạch lạc; thử đa dạng hoá từ nối.';
        if (averageBand >= 6.0) return 'Sử dụng các từ nối hợp lý, phân chia các đoạn văn rõ ràng và logic hơn.';
        return 'Tập trung liên kết câu và sử dụng đại từ thay thế phù hợp để bài viết mạch lạc hơn.';
      }

      if (key === 'lexical_resource') {
        if (averageBand >= 7.0) return 'Duy trì việc sử dụng từ vựng nâng cao và các cụm từ collocations một cách tự nhiên.';
        if (averageBand >= 6.0) return 'Cố gắng sử dụng thêm các từ đồng nghĩa và tránh lặp từ nhiều lần trong bài.';
        return 'Ôn từ vựng theo chủ đề; học collocations tránh lặp từ.';
      }

      if (key === 'grammar_range_accuracy') {
        if (averageBand >= 7.0) return 'Duy trì sự đa dạng câu và kiểm soát tốt các lỗi ngữ pháp nhỏ.';
        if (averageBand >= 6.0) return 'Rà soát thì và sự hòa hợp chủ-vị; viết vài câu phức ngắn.';
        return 'Cải thiện độ chính xác của các cấu trúc câu đơn giản trước khi chuyển sang viết câu phức.';
      }

      return '';
    };

    const items = criteriaKeys.map(({ key }) => {
      const currentScores = currentWindowSubs
        .map((s) => s.rubricScores[key])
        .filter((score) => typeof score === 'number' && !isNaN(score));

      if (currentScores.length < 3) {
        return {
          criterion: key,
          averageBand: null,
          deltaVsPreviousWindow: null,
          trend: 'unknown',
          recommendation: '',
        };
      }

      const currentSum = currentScores.reduce((acc, s) => acc + s, 0);
      const averageBand = Math.round((currentSum / currentScores.length) * 100) / 100;

      const prevScores = prevWindowSubs
        .map((s) => s.rubricScores[key])
        .filter((score) => typeof score === 'number' && !isNaN(score));

      let deltaVsPreviousWindow: number | null = null;
      let trend: 'up' | 'down' | 'flat' | 'unknown' = 'unknown';

      if (prevScores.length >= 3) {
        const prevSum = prevScores.reduce((acc, s) => acc + s, 0);
        const prevAverage = prevSum / prevScores.length;

        deltaVsPreviousWindow = Math.round((averageBand - prevAverage) * 100) / 100;

        if (deltaVsPreviousWindow > 0.25) {
          trend = 'up';
        } else if (deltaVsPreviousWindow < -0.25) {
          trend = 'down';
        } else {
          trend = 'flat';
        }
      }

      return {
        criterion: key,
        averageBand,
        deltaVsPreviousWindow,
        trend,
        recommendation: getRecommendation(key, averageBand),
      };
    });

    return {
      window,
      items,
    };
  }
}
