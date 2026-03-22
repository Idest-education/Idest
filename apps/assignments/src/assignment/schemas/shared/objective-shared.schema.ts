import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type MediaKind = 'image' | 'audio' | 'file';

export const OBJECTIVE_QUESTION_TYPES = [
  'gap_fill_template',
  'multiple_choice_single',
  'multiple_choice_multi',
  'true_false_not_given',
  'yes_no_not_given',
  'matching',
  'matching_headings',
  'diagram_labeling',
  'short_answer',
  'form_completion',
] as const;

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

  @Prop({
    required: true,
    enum: OBJECTIVE_QUESTION_TYPES,
  })
  type: string;

  @Prop()
  prompt_md?: string;

  /**
   * Optional per-question stimulus when it adds to (or overrides) the question group's shared stimulus.
   * Shared diagram/image for a multi-part task belongs on QuestionGroup.stimulus.
   */
  @Prop({ type: StimulusSchema })
  stimulus?: Stimulus;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  interaction: any;

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

  /**
   * Shared stimulus for all questions in this group (e.g. diagram/map image for labeling items 14–20).
   */
  @Prop({ type: StimulusSchema })
  stimulus?: Stimulus;

  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];
}
export const QuestionGroupSchema = SchemaFactory.createForClass(QuestionGroup);

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

  @Prop({ type: SchemaTypes.Mixed, required: true })
  material: ReadingSectionMaterial | ListeningSectionMaterial;

  @Prop({ type: [QuestionGroupSchema], default: [] })
  question_groups: QuestionGroup[];
}
export const SectionSchema = SchemaFactory.createForClass(Section);
