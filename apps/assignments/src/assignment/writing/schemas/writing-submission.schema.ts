import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type WritingSubmissionDocument = WritingSubmission & Document;

export type SubmissionStatus = 'pending' | 'graded' | 'failed';

@Schema({ collection: 'writing_submissions', timestamps: { createdAt: 'created_at', updatedAt: false } })
export class WritingSubmission {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  assignment_id: string;

  @Prop({ required: true })
  user_id: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  content_by_task_id: Record<string, string>;

  @Prop()
  score?: number;

  @Prop()
  feedback?: string;

  @Prop({ default: 'pending', enum: ['pending', 'graded', 'failed'] })
  status: SubmissionStatus;
}

export const WritingSubmissionSchema = SchemaFactory.createForClass(WritingSubmission);

WritingSubmissionSchema.virtual('id').get(function () {
  return this._id;
});
WritingSubmissionSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});
