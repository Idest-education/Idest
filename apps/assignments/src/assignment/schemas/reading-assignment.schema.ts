import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Section, SectionSchema } from './shared/objective-shared.schema';

export type ReadingAssignmentDocument = ReadingAssignment & Document;

@Schema({ collection: 'reading_assignments', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class ReadingAssignment {
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

  @Prop({ type: [SectionSchema], default: [] })
  sections: Section[];
}

export const ReadingAssignmentSchema = SchemaFactory.createForClass(ReadingAssignment);

ReadingAssignmentSchema.virtual('id').get(function () {
  return this._id;
});

ReadingAssignmentSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});
