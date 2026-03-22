import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { MediaAsset, MediaAssetSchema } from './shared/objective-shared.schema';

export type WritingAssignmentDocument = WritingAssignment & Document;

@Schema({ _id: false })
export class WritingTaskStimulus {
  @Prop({ type: [MediaAssetSchema], default: [] })
  images?: MediaAsset[];

  @Prop()
  data_description_md?: string;
}
export const WritingTaskStimulusSchema = SchemaFactory.createForClass(WritingTaskStimulus);

@Schema({ _id: false })
export class WritingTask {
  @Prop({ type: String, default: () => uuidv4() })
  id: string;

  @Prop({ required: true, enum: [1, 2] })
  task_number: 1 | 2;


  @Prop({ required: true })
  prompt_md: string;


  @Prop({ type: WritingTaskStimulusSchema })
  stimulus?: WritingTaskStimulus;

}
export const WritingTaskSchema = SchemaFactory.createForClass(WritingTask);

@Schema({ collection: 'writing_assignments', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class WritingAssignment {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  created_by: string;

  @Prop()
  class_id?: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  is_public: boolean;

  @Prop({ default: 1 })
  schema_version: number;

  @Prop({ type: [WritingTaskSchema], default: [] })
  tasks: WritingTask[];
}

export const WritingAssignmentSchema = SchemaFactory.createForClass(WritingAssignment);

WritingAssignmentSchema.virtual('id').get(function () {
  return this._id;
});
WritingAssignmentSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});
