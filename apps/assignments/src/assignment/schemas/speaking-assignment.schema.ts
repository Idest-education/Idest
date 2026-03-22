import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { MediaAsset, MediaAssetSchema } from './shared/objective-shared.schema';

export type SpeakingAssignmentDocument = SpeakingAssignment & Document;


@Schema({ _id: false })
export class SpeakingPart {
  @Prop({ required: true, enum: [1, 2, 3] })
  part_number: 1 | 2 | 3;

  @Prop({ required: true })
  question: string;
}
export const SpeakingPartSchema = SchemaFactory.createForClass(SpeakingPart);

@Schema({ collection: 'speaking_assignments', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class SpeakingAssignment {
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

  @Prop({ type: [SpeakingPartSchema], default: [] })
  parts: SpeakingPart[];
}

export const SpeakingAssignmentSchema = SchemaFactory.createForClass(SpeakingAssignment);

SpeakingAssignmentSchema.virtual('id').get(function () {
  return this._id;
});
SpeakingAssignmentSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});
