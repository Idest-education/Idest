import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SpeakingAssignment, SpeakingAssignmentDocument } from '../schemas/speaking-assignment.schema';
import { SpeakingResponse, SpeakingResponseDocument } from './schemas/speaking-response.schema';
import { CreateSpeakingResponseDto } from './dto/create-speaking-response.dto';
import { CreateSpeakingAssignmentDto } from './dto/create-speaking-assignment.dto';
import { UpdateSpeakingAssignmentDto } from './dto/update-speaking-assignment.dto';
import { GradeService } from '../../grade/grade.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { concatenateAudioFiles, getExtensionFromMimetype } from '../utils/audio.util';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SpeakingService {
  constructor(
    @InjectModel(SpeakingAssignment.name)
    private speakingAssignmentModel: Model<SpeakingAssignmentDocument>,
    @InjectModel(SpeakingResponse.name)
    private speakingResponseModel: Model<SpeakingResponseDocument>,
    private gradeService: GradeService,
    private supabaseService: SupabaseService,
  ) {}

  async createAssignment(dto: CreateSpeakingAssignmentDto) {
    const created = new this.speakingAssignmentModel(dto);
    return created.save();
  }

  async findAll() {
    return this.speakingAssignmentModel.find().exec();
  }

  async findOne(id: string) {
    return this.speakingAssignmentModel.findOne({ _id: id }).exec();
  }

  async update(id: string, dto: UpdateSpeakingAssignmentDto) {
    return this.speakingAssignmentModel
      .findOneAndUpdate({ _id: id }, dto, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string) {
    return this.speakingAssignmentModel.findOneAndDelete({ _id: id }).exec();
  }

  async submitResponse(
    dto: CreateSpeakingResponseDto,
    files: {
      audioOne?: Express.Multer.File[],
      audioTwo?: Express.Multer.File[],
      audioThree?: Express.Multer.File[],
    },
  ) {
    const assignment = await this.speakingAssignmentModel.findOne({ _id: dto.assignment_id }).exec();
    if (!assignment) throw new BadRequestException('assignment_id must reference a speaking assignment');
    
    const submissionId = dto.id || uuidv4();
    
    let transcriptOne: string | undefined;
    let transcriptTwo: string | undefined;
    let transcriptThree: string | undefined;
    let score: number | undefined;
    let feedback: string | undefined;
    let audioUrl: string | undefined;
    
    const audioFiles: Express.Multer.File[] = [];
    
    if (files.audioOne?.[0]) {
      console.log('Transcribing Part 1 audio...');
      audioFiles.push(files.audioOne[0]);
      transcriptOne = await this.gradeService.speechToText(files.audioOne[0]);
      console.log('Part 1 transcript:', transcriptOne);
    }
    
    if (files.audioTwo?.[0]) {
      console.log('Transcribing Part 2 audio...');
      audioFiles.push(files.audioTwo[0]);
      transcriptTwo = await this.gradeService.speechToText(files.audioTwo[0]);
      console.log('Part 2 transcript:', transcriptTwo);
    }
    
    if (files.audioThree?.[0]) {
      console.log('Transcribing Part 3 audio...');
      audioFiles.push(files.audioThree[0]);
      transcriptThree = await this.gradeService.speechToText(files.audioThree[0]);
      console.log('Part 3 transcript:', transcriptThree);
    }
    
    if (audioFiles.length > 0) {
      console.log(`Concatenating ${audioFiles.length} audio files...`);
      const { buffer, mimetype } = concatenateAudioFiles(audioFiles);
      
      const extension = getExtensionFromMimetype(mimetype);
      const fileName = `${submissionId}.${extension}`;
      
      console.log(`Uploading combined audio to Supabase bucket "audio" as ${fileName}...`);
      try {
        audioUrl = await this.supabaseService.uploadFile(
          'audio',
          fileName,
          buffer,
          mimetype,
        );
        console.log(`Audio uploaded successfully: ${audioUrl}`);
      } catch (error) {
        console.error('Failed to upload audio to Supabase:', error);
        audioUrl = '';
      }
    }
    
    if (transcriptOne || transcriptTwo || transcriptThree) {
      let question = `Speaking Assignment: ${assignment.title}\n\n`;
      let answer = '';
      
      assignment.parts.forEach(part => {
        question += `Part ${part.part_number}: \n`;
        part.questions.forEach(q => {
          question += `Q${q.order_index}: ${q.prompt}\n`;
        });
        question += '\n';
      });
      
      if (transcriptOne) {
        answer += `Part 1:\n${transcriptOne}\n\n`;
      }
      if (transcriptTwo) {
        answer += `Part 2:\n${transcriptTwo}\n\n`;
      }
      if (transcriptThree) {
        answer += `Part 3:\n${transcriptThree}\n\n`;
      }
      
      console.log('Grading speaking submission...');
      const gradeResponseText = await this.gradeService.gradeSpeakingSubmission(question, answer.trim());
      
      try {
        let jsonText = gradeResponseText.trim();
        
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        } else {
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }
        
        const gradeResponse = JSON.parse(jsonText);
        score = gradeResponse.score;
        feedback = gradeResponse.feedback;
        console.log('Grading complete. Score:', score);
      } catch (error) {
        console.error('Failed to parse grade response:', error);
        console.error('Raw response:', gradeResponseText);
      }
    }
    
    const payload = { 
      ...dto,
      id: submissionId,
      audio_url: audioUrl || '',
      transcriptOne,
      transcriptTwo,
      transcriptThree,
      score,
      feedback,
    } as any;
    const created = new this.speakingResponseModel(payload);
    return created.save();
  }

  async getResponse(id: string) {
    return this.speakingResponseModel.findOne({ id }).exec();
  }

  async getAllResponses() {
    return this.speakingResponseModel.find().exec();
  }

  async getUserResponses(userId: string) {
    return this.speakingResponseModel.find({ user_id: userId }).exec();
  }

  async getAssignmentResponses(assignmentId: string) {
    return this.speakingResponseModel.find({ assignment_id: assignmentId }).exec();
  }

  async speechToText(file: Express.Multer.File) {
    return this.gradeService.speechToText(file);
  }
}


