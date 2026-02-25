import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type WritingAssignmentDocument = WritingAssignment & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class WritingAssignment {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  taskone: string;

  @Prop({ required: true })
  tasktwo: string;

  @Prop()
  img?: string;

  @Prop()
  imgDescription?: string;
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

