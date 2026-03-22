import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type SpeakingSubmissionDocument = SpeakingSubmission & Document;

export type SubmissionStatus = 'pending' | 'graded' | 'failed';

@Schema({ _id: false })
export class TranscriptItem {
  @Prop({ required: true })
  part_number: number;

  @Prop()
  item_id?: string;

  @Prop()
  text?: string;
}
export const TranscriptItemSchema = SchemaFactory.createForClass(TranscriptItem);

@Schema({ collection: 'speaking_submissions', timestamps: { createdAt: 'created_at', updatedAt: false } })
export class SpeakingSubmission {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  assignment_id: string;

  @Prop({ required: true })
  user_id: string;

  @Prop()
  audio_url?: string;

  @Prop({ type: [TranscriptItemSchema], default: [] })
  transcripts?: TranscriptItem[];

  @Prop()
  score?: number;

  @Prop()
  feedback?: string;

  @Prop({ default: 'pending', enum: ['pending', 'graded', 'failed'] })
  status: SubmissionStatus;
}

export const SpeakingSubmissionSchema = SchemaFactory.createForClass(SpeakingSubmission);

SpeakingSubmissionSchema.virtual('id').get(function () {
  return this._id;
});
SpeakingSubmissionSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});
