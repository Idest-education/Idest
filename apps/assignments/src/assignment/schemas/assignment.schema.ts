import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type AssignmentDocument = Assignment & Document;

@Schema()
export class Subquestion {
  @Prop()
  subprompt?: string;

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ type: SchemaTypes.Mixed, required: true })
  answer: string | number | string[] | number[] | boolean;
}
export const SubquestionSchema = SchemaFactory.createForClass(Subquestion);

@Schema()
export class Question {
  @Prop({ type: String, default: () => uuidv4() })
  id: string;

  @Prop({ 
    required: true, 
    enum: ['fill_blank', 'multiple_choice', 'matching', 'map_labeling', 'true_false'] 
  })
  type: string;

  @Prop({ required: true })
  prompt: string;

  @Prop({ type: [SubquestionSchema], default: [] })
  subquestions: Subquestion[];
}
export const QuestionSchema = SchemaFactory.createForClass(Question);

@Schema()
export class ReadingMaterial {
  @Prop({ required: true })
  document: string;

  @Prop()
  image_url?: string;
}
export const ReadingMaterialSchema = SchemaFactory.createForClass(ReadingMaterial);

@Schema()
export class ListeningMaterial {
  @Prop({ required: true })
  audio_url: string;

  @Prop()
  transcript?: string;

  @Prop()
  image_url?: string;
}
export const ListeningMaterialSchema = SchemaFactory.createForClass(ListeningMaterial);

@Schema()
export class Section {
  @Prop({ type: String, default: () => uuidv4() })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  order_index: number;

  @Prop()
  material_url?: string;

  @Prop({ type: ReadingMaterialSchema })
  reading_material?: ReadingMaterial;

  @Prop({ type: ListeningMaterialSchema })
  listening_material?: ListeningMaterial;

  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];
}
export const SectionSchema = SchemaFactory.createForClass(Section);

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class Assignment {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  created_by: string;

  @Prop()
  class_id?: string;

  @Prop({ 
    required: true, 
    enum: ['reading', 'listening', 'writing', 'speaking'] 
  })
  skill: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  is_public: boolean;

  @Prop({ type: [SectionSchema], default: [] })
  sections: Section[];
}
export const AssignmentSchema = SchemaFactory.createForClass(Assignment);

AssignmentSchema.virtual('id').get(function () {
  return this._id;
});
AssignmentSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});