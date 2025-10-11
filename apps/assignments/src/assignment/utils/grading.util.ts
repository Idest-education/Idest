import { Assignment } from '../schemas/assignment.schema';
import { SubmitAssignmentDto } from '../dto/submit-assignment.dto';

export interface GradingResult {
  score: number;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  percentage: number;
  details: {
    section_id: string;
    section_title: string;
    questions: {
      question_id: string;
      subquestions: {
        correct: boolean;
        submitted_answer: any;
        correct_answer: any;
      }[];
    }[];
  }[];
}

function normalizeValue(value: any): any {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  return value;
}

function compareAnswers(submitted: any, correct: any): boolean {
  if (Array.isArray(correct) && Array.isArray(submitted)) {
    if (correct.length !== submitted.length) return false;
    const sortedCorrect = [...correct].map(normalizeValue).sort();
    const sortedSubmitted = [...submitted].map(normalizeValue).sort();
    return sortedCorrect.every((val, idx) => val === sortedSubmitted[idx]);
  }
  
  if (typeof submitted === 'string' && typeof correct === 'string') {
    return normalizeValue(submitted) === normalizeValue(correct);
  }
  
  return submitted === correct;
}

function roundToHalf(score: number): number {
  const rounded = Math.round(score * 2) / 2;
  return Math.max(0, Math.min(9, rounded));
}

export function gradeAssignment(
  assignment: Assignment,
  submission: SubmitAssignmentDto,
): GradingResult {
  let totalSubquestions = 0;
  let correctCount = 0;
  const details: GradingResult['details'] = [];

  for (const section of assignment.sections) {
    const submittedSection = submission.section_answers.find(
      (s) => s.id === section.id,
    );

    const sectionDetail = {
      section_id: section.id,
      section_title: section.title,
      questions: [] as GradingResult['details'][0]['questions'],
    };

    for (const question of section.questions) {
      const submittedQuestion = submittedSection?.question_answers.find(
        (q) => q.id === question.id,
      );

      const questionDetail = {
        question_id: question.id,
        subquestions: [] as GradingResult['details'][0]['questions'][0]['subquestions'],
      };

      for (let i = 0; i < question.subquestions.length; i++) {
        totalSubquestions++;
        const correctAnswer = question.subquestions[i].answer;
        const submittedAnswer =
          submittedQuestion?.subquestion_answers[i]?.answer;

        const isCorrect = compareAnswers(submittedAnswer, correctAnswer);
        if (isCorrect) correctCount++;

        questionDetail.subquestions.push({
          correct: isCorrect,
          submitted_answer: submittedAnswer,
          correct_answer: correctAnswer,
        });
      }

      sectionDetail.questions.push(questionDetail);
    }

    details.push(sectionDetail);
  }

  const percentage = totalSubquestions > 0 ? (correctCount / totalSubquestions) * 100 : 0;
  const rawScore = (percentage / 100) * 9;
  const score = roundToHalf(rawScore);

  return {
    score,
    total_questions: totalSubquestions,
    correct_answers: correctCount,
    incorrect_answers: totalSubquestions - correctCount,
    percentage: Math.round(percentage * 100) / 100,
    details,
  };
}

