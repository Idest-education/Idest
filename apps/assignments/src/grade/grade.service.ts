import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { OpenAI } from 'openai';
import { RabbitService } from '../rabbit/rabbit.service';
import { ReadingService } from '../assignment/reading/reading.service';
import { ListeningService } from '../assignment/listening/listening.service';
import { WritingService } from '../assignment/writing/writing.service';
import { SpeakingService } from '../assignment/speaking/speaking.service';

@Injectable()
export class GradeService implements OnModuleInit {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(GradeService.name);

  constructor(
    private readonly rabbitService: RabbitService,
    private readonly readingService: ReadingService,
    private readonly listeningService: ListeningService,
    @Inject(forwardRef(() => WritingService))
    private readonly writingService: WritingService,
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
        
        case 'writing':
          await this.gradeWriting(message);
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

  private async gradeWriting(message: any) {
    this.logger.log(`Grading writing assignment: ${message.assignmentId}`);
    
    const submission = {
      assignment_id: message.assignmentId,
      user_id: message.userId,
      contentOne: message.contentOne,
      contentTwo: message.contentTwo,
    };
    
    const result = await this.writingService.submitEssay(submission);
    this.logger.log(`Writing graded successfully. Score: ${result.score}`);
  }

  private async gradeSpeaking(message: any) {
    this.logger.log(`Grading speaking assignment: ${message.assignmentId}`);
    
    const dto = {
      assignment_id: message.assignmentId,
      user_id: message.userId,
      id: message.id,
    };
    
    const files: {
      audioOne?: Express.Multer.File[],
      audioTwo?: Express.Multer.File[],
      audioThree?: Express.Multer.File[],
    } = {};
    
    if (message.audios?.audioOne) {
      files.audioOne = [this.base64ToMulterFile(message.audios.audioOne, 'audioOne.webm')];
    }
    
    if (message.audios?.audioTwo) {
      files.audioTwo = [this.base64ToMulterFile(message.audios.audioTwo, 'audioTwo.webm')];
    }
    
    if (message.audios?.audioThree) {
      files.audioThree = [this.base64ToMulterFile(message.audios.audioThree, 'audioThree.webm')];
    }
    
    const result = await this.speakingService.submitResponse(dto, files);
    this.logger.log(`Speaking graded successfully. Score: ${result.score}`);
  }

  private base64ToMulterFile(base64: string, filename: string): Express.Multer.File {
    const buffer = Buffer.from(base64, 'base64');
    
    return {
      fieldname: filename.split('.')[0],
      originalname: filename,
      encoding: '7bit',
      mimetype: 'audio/webm',
      buffer: buffer,
      size: buffer.length,
    } as Express.Multer.File;
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

  async gradeWritingSubmission(submission: string, question: string) {
    const systemPrompt = `You are a helpful and fair IELTS writing teacher for the tutoring platform "Idest".
Your task is to evaluate the user's writing submission according to the official IELTS Writing rubric (Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy).

Be slightly generous with the score (around +0.5 to +1.0 higher if the score is borderline).  
Trust the user's submission over any attached image descriptions if they conflict.  
Ignore formatting issues (like spacing or structure) but do evaluate grammar, vocabulary, and spelling.

Here is the question:
${question}

Here is the submission:
${submission}

IMPORTANT: Respond with **only** a valid JSON object and nothing else.  
No markdown, no code blocks, no explanations.  
Format exactly like this:
{"score": <number>, "feedback": "<string>"}`;

    const response = await this.openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: systemPrompt },
      ],
    });
    return response.output_text;
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
