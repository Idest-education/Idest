import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type SubmissionDocument = Submission & Document;

@Schema()
export class SubquestionResult {
  @Prop({ required: true })
  correct: boolean;

  @Prop({ type: SchemaTypes.Mixed })
  submitted_answer: any;

  @Prop({ type: SchemaTypes.Mixed })
  correct_answer: any;
}
export const SubquestionResultSchema = SchemaFactory.createForClass(SubquestionResult);

@Schema()
export class QuestionResult {
  @Prop({ required: true })
  question_id: string;

  @Prop({ type: [SubquestionResultSchema], default: [] })
  subquestions: SubquestionResult[];
}
export const QuestionResultSchema = SchemaFactory.createForClass(QuestionResult);

@Schema()
export class SectionResult {
  @Prop({ required: true })
  section_id: string;

  @Prop({ required: true })
  section_title: string;

  @Prop({ type: [QuestionResultSchema], default: [] })
  questions: QuestionResult[];
}
export const SectionResultSchema = SchemaFactory.createForClass(SectionResult);

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class Submission {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  assignment_id: string;

  @Prop({ required: true })
  submitted_by: string;

  @Prop({ 
    required: true, 
    enum: ['reading', 'listening', 'writing', 'speaking'] 
  })
  skill: string;

  @Prop({ required: true, min: 0, max: 9 })
  score: number;

  @Prop({ required: true })
  total_questions: number;

  @Prop({ required: true })
  correct_answers: number;

  @Prop({ required: true })
  incorrect_answers: number;

  @Prop({ required: true })
  percentage: number;

  @Prop({ type: [SectionResultSchema], default: [] })
  details: SectionResult[];
}
export const SubmissionSchema = SchemaFactory.createForClass(Submission);

SubmissionSchema.virtual('id').get(function () {
  return this._id;
});
SubmissionSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

