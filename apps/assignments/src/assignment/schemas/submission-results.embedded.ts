import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';

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
export class PartResult {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  correct: boolean;

  @Prop({ type: SchemaTypes.Mixed })
  submitted_answer: any;

  @Prop({ type: SchemaTypes.Mixed })
  correct_answer: any;
}
export const PartResultSchema = SchemaFactory.createForClass(PartResult);

@Schema()
export class QuestionResult {
  @Prop({ required: true })
  question_id: string;

  @Prop({ default: false })
  correct?: boolean;

  @Prop({ type: [PartResultSchema], default: [] })
  parts?: PartResult[];

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
