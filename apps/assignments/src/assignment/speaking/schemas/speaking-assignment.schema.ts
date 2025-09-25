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

  @Prop({ required: true })
  description: string;

  @Prop({ type: [SpeakingQuestionSchema], default: [] })
  questions: SpeakingQuestion[];
}

export const SpeakingPartSchema = SchemaFactory.createForClass(SpeakingPart);

@Schema()
export class SpeakingAssignment {
  @Prop({ required: true, default: uuidv4 })
  id: string;

  @Prop({ type: [SpeakingPartSchema], default: [] })
  parts: SpeakingPart[];
}

export const SpeakingAssignmentSchema = SchemaFactory.createForClass(SpeakingAssignment);


