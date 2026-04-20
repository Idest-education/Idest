import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { OpenAI } from 'openai';
import { RabbitService } from '../rabbit/rabbit.service';
import { ReadingService } from '../assignment/reading/reading.service';
import { ListeningService } from '../assignment/listening/listening.service';
import { SpeakingService } from '../assignment/speaking/speaking.service';

@Injectable()
export class GradeService implements OnModuleInit {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(GradeService.name);

  constructor(
    private readonly rabbitService: RabbitService,
    private readonly readingService: ReadingService,
    private readonly listeningService: ListeningService,
    @Inject(forwardRef(() => SpeakingService))
    private readonly speakingService: SpeakingService,
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
        
        case 'speaking':
          await this.gradeSpeaking(message);
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

  private async gradeSpeaking(message: any) {
    const assignmentId = message.assignmentId;
    const userId = message.userId;
    const responseId = message.responseId || message.id;

    this.logger.log(`Grading speaking assignment: ${assignmentId} (responseId: ${responseId})`);

    if (!assignmentId || !userId || !responseId) {
      this.logger.error('Missing required fields for speaking grading', {
        assignmentId,
        userId,
        responseId,
      });
      return;
    }

    try {
      const assignment: any = await this.speakingService.findOne(assignmentId);
      if (!assignment) {
        this.logger.error(`Speaking assignment not found: ${assignmentId}`);
        await this.speakingService.markResponseFailed(responseId);
        return;
      }

      const audioOne = this.base64ToMulterFile(message.audios?.audioOne, 'audioOne.webm');
      const audioTwo = this.base64ToMulterFile(message.audios?.audioTwo, 'audioTwo.webm');
      const audioThree = this.base64ToMulterFile(message.audios?.audioThree, 'audioThree.webm');

      let transcriptOne: string | undefined;
      let transcriptTwo: string | undefined;
      let transcriptThree: string | undefined;

      if (audioOne) transcriptOne = await this.speechToText(audioOne);
      if (audioTwo) transcriptTwo = await this.speechToText(audioTwo);
      if (audioThree) transcriptThree = await this.speechToText(audioThree);

      let question = `Speaking Assignment: ${assignment.title}\n\n`;
      let answer = '';

      assignment.parts?.forEach((part: any) => {
        question += `Part ${part.part_number}:\n`;
        if (part.cue_card) {
          question += `Topic: ${part.cue_card.topic_md}\n`;
          (part.cue_card.bullet_points ?? []).forEach((b: string) => {
            question += `- ${b}\n`;
          });
        }
        (part.items ?? []).forEach((item: any) => {
          question += `Q: ${item.prompt_md}\n`;
          (item.follow_up_prompts ?? []).forEach((f: string) => {
            question += `  Follow-up: ${f}\n`;
          });
        });
        question += '\n';
      });

      const transcripts: Array<{ part_number: number; item_id?: string; text?: string }> = [];
      if (transcriptOne) transcripts.push({ part_number: 1, text: transcriptOne });
      if (transcriptTwo) transcripts.push({ part_number: 2, text: transcriptTwo });
      if (transcriptThree) transcripts.push({ part_number: 3, text: transcriptThree });
      answer = transcripts.map((t) => `Part ${t.part_number}:\n${t.text ?? ''}`).join('\n\n');

      const gradeResponseText = await this.gradeSpeakingSubmission(
        question,
        answer.trim(),
      );

      const gradeResponse = this.safeParseJson(gradeResponseText) as
        | { score?: number; feedback?: string }
        | null;

      if (!gradeResponse) {
        await this.speakingService.markResponseFailed(responseId);
        return;
      }

      const transcriptItems: Array<{ part_number: number; item_id?: string; text?: string }> = [];
      if (transcriptOne) transcriptItems.push({ part_number: 1, text: transcriptOne });
      if (transcriptTwo) transcriptItems.push({ part_number: 2, text: transcriptTwo });
      if (transcriptThree) transcriptItems.push({ part_number: 3, text: transcriptThree });

      const result = await this.speakingService.updateResponseGrade({
        responseId,
        transcripts: transcriptItems,
        score: gradeResponse.score,
        feedback: gradeResponse.feedback,
      });

      this.logger.log(`Speaking graded successfully. Score: ${result?.score}`);
    } catch (error) {
      this.logger.error('Speaking grading failed', error);
      await this.speakingService.markResponseFailed(responseId);
    }
  }

  private base64ToMulterFile(
    payload: any,
    fallbackFilename: string,
  ): Express.Multer.File | undefined {
    if (!payload) return undefined;

    // Backward-compat: payload can be a base64 string.
    if (typeof payload === 'string') {
      const buffer = Buffer.from(payload, 'base64');
      return {
        fieldname: fallbackFilename.split('.')[0],
        originalname: fallbackFilename,
        encoding: '7bit',
        mimetype: 'audio/webm',
        buffer,
        size: buffer.length,
      } as Express.Multer.File;
    }

    // New format: { data: base64, mimetype, originalname }
    const base64 = payload.data;
    if (typeof base64 !== 'string') return undefined;

    const buffer = Buffer.from(base64, 'base64');
    const originalname =
      typeof payload.originalname === 'string' ? payload.originalname : fallbackFilename;
    const mimetype =
      typeof payload.mimetype === 'string' ? payload.mimetype : 'audio/webm';

    return {
      fieldname: fallbackFilename.split('.')[0],
      originalname,
      encoding: '7bit',
      mimetype,
      buffer,
      size: buffer.length,
    } as Express.Multer.File;
  }

  private safeParseJson(text: string): any | null {
    try {
      let jsonText = (text ?? '').trim();
      const codeBlockMatch = jsonText.match(
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
      );
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }
      return JSON.parse(jsonText);
    } catch (e) {
      this.logger.error('Failed to parse JSON from model output', {
        textPreview: (text ?? '').slice(0, 500),
      });
      return null;
    }
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

  async speechToText(file: Express.Multer.File) {
    console.log(file);
    
    const uint8Array = new Uint8Array(file.buffer);
    const blob = new Blob([uint8Array], { type: file.mimetype });
    const audioFile = new File([blob], file.originalname, {
      type: file.mimetype,
    });
    
    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });
    console.log(response);
    return response.text;
  }

  async gradeSpeakingSubmission(question: string, answer: string) {
    const systemPrompt = `You are a helpful and fair IELTS speaking teacher for the tutoring platform "Idest".
Your task is to evaluate the user's speaking submission according to the official IELTS Speaking rubric (Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy).

Be slightly generous with the score (around +0.5 to +1.0 higher if the score is borderline).  
Ignore formatting issues (like spacing or structure) but do evaluate grammar, vocabulary, and spelling.

Here is the question:
${question}

Here is the answer:
${answer}

IMPORTANT: Respond with ONLY a valid JSON object, no markdown, no code blocks, no additional text. Just the JSON object in this exact format:
{"score": <number>, "feedback": "<string>"}`;

    const response = await this.openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: systemPrompt },
      ],
    });
    return response.output_text;
  }
}
