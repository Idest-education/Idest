import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type SpeakingResponseDocument = SpeakingResponse & Document;

@Schema()
export class SpeakingResponse {
  @Prop({ required: true, default: uuidv4 })
  id: string;

  @Prop({ required: true })
  assignment_id: string;

  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true })
  part_number: number;

  @Prop({ required: true })
  audio_url: string;

  @Prop()
  transcript?: string;

  @Prop()
  score?: number;

  @Prop({ default: Date.now })
  created_at: Date;
}

export const SpeakingResponseSchema = SchemaFactory.createForClass(SpeakingResponse);


