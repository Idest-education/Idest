import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type SpeakingAssignmentDocument = SpeakingAssignment & Document;

@Schema()
export class SpeakingQuestion {
  @Prop({ required: true })
  prompt: string;

  @Prop({ required: true })
  order_index: number;
}

export const SpeakingQuestionSchema = SchemaFactory.createForClass(SpeakingQuestion);

@Schema()
export class SpeakingPart {
  @Prop({ required: true })
  part_number: number;


  @Prop({ type: [SpeakingQuestionSchema], default: [] })
  questions: SpeakingQuestion[];
}

export const SpeakingPartSchema = SchemaFactory.createForClass(SpeakingPart);

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class SpeakingAssignment {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  title: string;


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


