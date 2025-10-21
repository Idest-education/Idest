import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import {
  getContextCategoryWithRegex,
  isVietnamesePrompt,
  PromptContext,
} from './ai.util';
import { UserService } from 'src/user/user.service';
import { User } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';
import { ClassService } from 'src/class/class.service';

@Injectable()
export class AiService {
  private readonly openai: OpenAI;

  constructor(
    private readonly userService: UserService,
    private readonly classService: ClassService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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

  async generateTextWithContext(prompt: string, user: User) {
    const contextCategory = await this.getContextCategory(prompt);
    console.log('getting context for: ', contextCategory);
    const context = await this.getContext(
      contextCategory as PromptContext,
      user,
    );
    const systemPrompt = `
    You are a helpful assistant for an IELTS tutoring platform "Idest".
    You should use the context to answer the prompt in a concise manner and in the same language as the user's prompt.
    Here is the context:
    ${context}
    `;
    console.log('system prompt: ', systemPrompt);
    console.log('prompt: ', prompt);
    const response = await this.openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });
    console.log('response: ', response);
    return response.output_text;
  }

  async getContextCategory(prompt: string) {
    const context = getContextCategoryWithRegex(prompt);
    console.log('regex result: ', context);
    if (context != 'Others') {
      return context;
    }
    console.log('regex failed, using gpt to get context category');
    const systemPrompt = `
    Response with just the label, nothing else. Look at the user's prompt and label it as one of the following:
    - User
    - Class
    - Others
    `;
    const response = await this.openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });
    console.log('gpt regex result: ', response.output_text);
    return response.output_text;
  }

  async getContext(category: PromptContext, user: User): Promise<string> {
    if (category == 'Others') {
      return 'No context found, answer with basic IELTS knowledge';
    }
    switch (category) {
      case 'User':
        const userDetails = await this.userService.getUserById(user.id);
        return JSON.stringify(userDetails);
      case 'Class':
        const userClasses = await this.classService.getUserClasses(user.id);
        return JSON.stringify(userClasses);
      default:
        return 'No context found, answer with basic IELTS knowledge';
    }
  }
  async gradeWritingSubmission(submission: string, question: string) {
    const systemPrompt = `
    You are a helpful teacher for an IELTS tutoring platform "Idest".
    You should grade the writing submission of the user and give feedback on it based on the IELTS writing rubric.
    Here is the question:
    ${question}
    Here is the submission:
    ${submission}

    `;
    const response = await this.openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: systemPrompt },
      ],
    });
    return response.output_text;
  }
  async gradeSpeakingSubmission(question: string, answer: string) {
    const systemPrompt = `
    You are a helpful teacher for an IELTS tutoring platform "Idest".
    You should grade the speaking submission of the user and give feedback on it based on the IELTS speaking rubric.
    Here is the question:
    ${question}
    Here is the answer:
    ${answer}
    `;
    const response = await this.openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: systemPrompt },
      ],
    });
    return response.output_text;
  }
}
