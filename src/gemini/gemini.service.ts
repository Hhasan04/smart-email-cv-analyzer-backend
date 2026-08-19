import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const matchResultSchema = z.object({
  jobPositionId: z.string().nullable(),
});

export interface JobPositionOption {
  id: string;
  title: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenerativeAI;

  constructor(configService: ConfigService) {
    this.client = new GoogleGenerativeAI(
      configService.getOrThrow<string>('GEMINI_API_KEY'),
    );
  }

  async matchJobPosition(
    jobPositions: JobPositionOption[],
    email: { subject: string; body: string },
  ): Promise<string | null> {
    if (jobPositions.length === 0) {
      return null;
    }

    const model = this.client.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const jobPositionsList = jobPositions
      .map((p) => `- id: ${p.id}, title: "${p.title}"`)
      .join('\n');

    const prompt = `You are triaging inbound candidate emails for a recruiting inbox.
Given the open job positions below and an email's subject/body, decide which single job position the sender is most likely applying for.

Open job positions:
${jobPositionsList}

Email subject: ${email.subject}
Email body:
${email.body}

Respond with ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:
{"jobPositionId": "<id from the list above>" or null if no listed position clearly matches}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    try {
      const parsed = matchResultSchema.parse(JSON.parse(stripCodeFence(raw)));
      if (
        parsed.jobPositionId &&
        !jobPositions.some((p) => p.id === parsed.jobPositionId)
      ) {
        return null;
      }
      return parsed.jobPositionId;
    } catch (error) {
      this.logger.warn(
        `Failed to parse Gemini job-match response: ${raw}`,
        error as Error,
      );
      return null;
    }
  }
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
}
