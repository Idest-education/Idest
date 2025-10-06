import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';

@Injectable()
export class GradeService {
  private readonly openai: OpenAI;

  constructor(
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

  async gradeWritingSubmission(submission: string, question: string) {
    const systemPrompt = `You are a helpful and fair IELTS writing teacher for the tutoring platform "Idest".
Your task is to evaluate the user's writing submission according to the official IELTS Writing rubric (Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy).

Be slightly generous with the score (around +0.5 to +1.0 higher if the score is borderline).  
Trust the user’s submission over any attached image descriptions if they conflict.  
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
