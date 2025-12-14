import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type WritingSubmissionDocument = WritingSubmission & Document;

export type SubmissionStatus = 'pending' | 'graded' | 'failed';

@Schema()
export class WritingSubmission {
  @Prop({ required: true, default: uuidv4 })
  id: string;

  @Prop({ required: true })
  assignment_id: string;

  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true })
  contentOne: string;

  @Prop({ required: true })
  contentTwo: string;

  @Prop()
  score?: number;

  @Prop()
  feedback?: string;

  @Prop({ default: 'pending', enum: ['pending', 'graded', 'failed'] })
  status: SubmissionStatus;

  @Prop({ default: Date.now })
  created_at: Date;
}

export const WritingSubmissionSchema = SchemaFactory.createForClass(WritingSubmission);


