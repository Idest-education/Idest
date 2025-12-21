import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Assignment Schema V2
 * - Stimulus/template-based questions
 * - Rich media assets
 * - Backward incompatible with v1 (DB reset OK)
 */

export type AssignmentDocument = Assignment & Document;

export type Skill = 'reading' | 'listening' | 'writing' | 'speaking';

export type MediaKind = 'image' | 'audio' | 'file';

@Schema({ _id: false })
export class MediaAsset {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: ['image', 'audio', 'file'] })
  kind: MediaKind;

  @Prop({ required: true })
  url: string;

  @Prop()
  mime?: string;

  @Prop()
  title?: string;

  @Prop()
  alt?: string;

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  duration_seconds?: number;
}
export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);

@Schema({ _id: false })
export class StimulusTemplateBlank {
  @Prop({ required: true })
  blank_id: string;

  @Prop()
  placeholder_label?: string;
}
export const StimulusTemplateBlankSchema = SchemaFactory.createForClass(StimulusTemplateBlank);

@Schema({ _id: false })
export class StimulusTemplate {
  @Prop({ required: true, enum: ['text'] })
  format: 'text';

  /**
   * Template body with placeholders: {{blank:1}}, {{blank:2}}, etc.
   */
  @Prop({ required: true })
  body: string;

  @Prop({ type: [StimulusTemplateBlankSchema], default: [] })
  blanks: StimulusTemplateBlank[];
}
export const StimulusTemplateSchema = SchemaFactory.createForClass(StimulusTemplate);

@Schema({ _id: false })
export class Stimulus {
  @Prop()
  instructions_md?: string;

  @Prop()
  content_md?: string;

  @Prop({ type: [MediaAssetSchema], default: [] })
  media?: MediaAsset[];

  @Prop({ type: StimulusTemplateSchema })
  template?: StimulusTemplate;
}
export const StimulusSchema = SchemaFactory.createForClass(Stimulus);

@Schema({ _id: false })
export class Question {
  @Prop({ type: String, default: () => uuidv4() })
  id: string;

  @Prop({ required: true })
  order_index: number;

  /**
   * Discriminated by DTO/service validation. Add new types freely.
   */
  @Prop({
    required: true,
    enum: [
      'gap_fill_template',
      'multiple_choice_single',
      'multiple_choice_multi',
      'true_false_not_given',
      'matching',
      'diagram_labeling',
      'short_answer',
    ],
  })
  type: string;

  @Prop()
  prompt_md?: string;

  @Prop({ type: StimulusSchema, required: true })
  stimulus: Stimulus;

  /**
   * Interaction model depends on type (stored as JSON).
   * Example shapes:
   * - gap_fill_template: { blanks: Array<{ blank_id, input: { kind: 'text' } }> }
   * - multiple_choice_single: { options: Array<{ id, label_md }> }
   * - matching: { left: Array<{ id, label_md }>, right: Array<{ id, label_md }> }
   */
  @Prop({ type: SchemaTypes.Mixed, required: true })
  interaction: any;

  /**
   * Answer key depends on type (stored as JSON). This is server-side truth for grading.
   */
  @Prop({ type: SchemaTypes.Mixed, required: true })
  answer_key: any;
}
export const QuestionSchema = SchemaFactory.createForClass(Question);

@Schema({ _id: false })
export class QuestionGroup {
  @Prop({ type: String, default: () => uuidv4() })
  id: string;

  @Prop({ required: true })
  order_index: number;

  @Prop()
  title?: string;

  @Prop()
  instructions_md?: string;

  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];
}
export const QuestionGroupSchema = SchemaFactory.createForClass(QuestionGroup);

export type SectionMaterialType = 'reading' | 'listening';

@Schema({ _id: false })
export class ReadingSectionMaterial {
  @Prop({ required: true, enum: ['reading'] })
  type: 'reading';

  @Prop({ required: true })
  document_md: string;

  @Prop({ type: [MediaAssetSchema], default: [] })
  images?: MediaAsset[];
}
export const ReadingSectionMaterialSchema = SchemaFactory.createForClass(ReadingSectionMaterial);

@Schema({ _id: false })
export class ListeningSectionMaterial {
  @Prop({ required: true, enum: ['listening'] })
  type: 'listening';

  @Prop({ type: MediaAssetSchema, required: true })
  audio: MediaAsset;

  @Prop()
  transcript_md?: string;

  @Prop({ type: [MediaAssetSchema], default: [] })
  images?: MediaAsset[];
}
export const ListeningSectionMaterialSchema = SchemaFactory.createForClass(ListeningSectionMaterial);

@Schema({ _id: false })
export class Section {
  @Prop({ type: String, default: () => uuidv4() })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  order_index: number;

  /**
   * Discriminated union stored as Mixed for flexibility; validated by DTO/service.
   */
  @Prop({ type: SchemaTypes.Mixed, required: true })
  material: ReadingSectionMaterial | ListeningSectionMaterial;

  @Prop({ type: [QuestionGroupSchema], default: [] })
  question_groups: QuestionGroup[];
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
    enum: ['reading', 'listening', 'writing', 'speaking'],
  })
  skill: Skill;

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


