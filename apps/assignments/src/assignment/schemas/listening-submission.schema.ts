import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { SectionResult, SectionResultSchema } from './submission-results.embedded';

export type ListeningSubmissionDocument = ListeningSubmission & Document;

@Schema({ collection: 'listening_submissions', timestamps: { createdAt: 'created_at', updatedAt: false } })
export class ListeningSubmission {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  assignment_id: string;

  @Prop({ required: true })
  submitted_by: string;

  @Prop({ type: SchemaTypes.Mixed })
  answers?: any;

  @Prop({ required: true, min: 0, max: 9 })
  score: number;

  @Prop({ required: true })
  total_questions: number;

  @Prop({ required: true })
  correct_answers: number;

  @Prop({ required: true })
  incorrect_answers: number;

  @Prop({ required: true })
  percentage: number;

  @Prop({ type: [SectionResultSchema], default: [] })
  details: SectionResult[] | any;
}

export const ListeningSubmissionSchema = SchemaFactory.createForClass(ListeningSubmission);

ListeningSubmissionSchema.virtual('id').get(function () {
  return this._id;
});
ListeningSubmissionSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: any) => {
    delete ret.__v;
    return ret;
  },
});
