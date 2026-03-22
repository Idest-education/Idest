import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Section, SectionSchema } from './shared/objective-shared.schema';

export type ListeningAssignmentDocument = ListeningAssignment & Document;

@Schema({ collection: 'listening_assignments', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class ListeningAssignment {
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

export const ListeningAssignmentSchema = SchemaFactory.createForClass(ListeningAssignment);

ListeningAssignmentSchema.virtual('id').get(function () {
  return this._id;
});

ListeningAssignmentSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});
