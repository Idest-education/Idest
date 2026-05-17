import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { RabbitService } from '../rabbit/rabbit.service';
import { ReadingService } from '../assignment/reading/reading.service';
import { ListeningService } from '../assignment/listening/listening.service';

@Injectable()
export class GradeService implements OnModuleInit {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(GradeService.name);

  constructor(
    private readonly rabbitService: RabbitService,
    private readonly readingService: ReadingService,
    private readonly listeningService: ListeningService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async onModuleInit() {
    this.logger.log('Starting to consume from grade_queue...');
    await this.rabbitService.consume('grade_queue', async (message) => {
      await this.processGradeMessage(message);
    });
  }

  private async processGradeMessage(message: any) {
    this.logger.log(`Processing grade message for skill: ${message.skill}`);

    try {
      switch (message.skill) {
        case 'reading':
          await this.gradeReading(message);
          break;

        case 'listening':
          await this.gradeListening(message);
          break;

        default:
          this.logger.error(`Unknown skill type: ${message.skill}`);
      }
    } catch (error) {
      this.logger.error(`Error processing ${message.skill} grade:`, error);
      throw error; // This will cause the message to be requeued
    }
  }

  private async gradeReading(message: any) {
    this.logger.log(`Grading reading assignment: ${message.assignmentId}`);

    const submission = {
      assignment_id: message.assignmentId,
      submitted_by: message.userId,
      section_answers: message.sections,
    };

    const result = await this.readingService.gradeSubmission(submission);
    this.logger.log(`Reading graded successfully. Score: ${result.score}`);
  }

  private async gradeListening(message: any) {
    this.logger.log(`Grading listening assignment: ${message.assignmentId}`);

    const submission = {
      assignment_id: message.assignmentId,
      submitted_by: message.userId,
      section_answers: message.sections,
    };

    const result = await this.listeningService.gradeSubmission(submission);
    this.logger.log(`Listening graded successfully. Score: ${result.score}`);
  }

  async generateText(prompt: string) {
    console.log(prompt);
    const response = await this.openai.responses.create({
      model: 'gpt-5-nano',
      input: prompt,
    });
    console.log(response);
    return response.output_text;
  }

  private detectAudioFormat(buf: Buffer): { extension: string; mimetype: string } {
    if (buf.length >= 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WAVE')
      return { extension: 'wav', mimetype: 'audio/wav' };
    if (buf.length >= 8 && buf.slice(4, 8).toString() === 'ftyp')
      return { extension: 'm4a', mimetype: 'audio/mp4' };
    if (buf.length >= 4 && buf.slice(0, 4).toString() === 'OggS')
      return { extension: 'ogg', mimetype: 'audio/ogg' };
    if (buf.length >= 4 && buf.slice(0, 4).toString() === 'fLaC')
      return { extension: 'flac', mimetype: 'audio/flac' };
    if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3)
      return { extension: 'webm', mimetype: 'audio/webm' };
    if (buf.length >= 3 && buf.slice(0, 3).toString() === 'ID3')
      return { extension: 'mp3', mimetype: 'audio/mpeg' };
    if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
      return { extension: 'mp3', mimetype: 'audio/mpeg' };
    return { extension: 'wav', mimetype: 'audio/wav' };
  }

  async speechToText(file: Express.Multer.File) {
    const { extension, mimetype } = this.detectAudioFormat(file.buffer);
    const uint8Array = new Uint8Array(file.buffer);
    const blob = new Blob([uint8Array], { type: mimetype });
    const audioFile = new File([blob], `audio.${extension}`, { type: mimetype });

    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });
    return response.text;
  }
}
