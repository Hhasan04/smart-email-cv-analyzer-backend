import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const matchResultSchema = z.object({
  jobPositionId: z.string().nullable(),
});

const scoreResultSchema = z.object({
  matchScore: z.number().min(0).max(100),
  matchingSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  summaryText: z.string(),
});

export interface JobPositionOption {
  id: string;
  title: string;
}

export interface ScoringJobPosition {
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
}

export type ScoreResult = z.infer<typeof scoreResultSchema>;

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

    const model = this.client.getGenerativeModel({ model: 'gemini-3.6-flash' });
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

    let raw: string;
    try {
      const result = await model.generateContent(prompt);
      raw = result.response.text().trim();
    } catch (error) {
      this.logger.warn(
        `Gemini job-match call failed: ${(error as Error).message}`,
      );
      return null;
    }

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
        `Failed to parse Gemini job-match response (${(error as Error).message}): ${raw}`,
      );
      return null;
    }
  }

  async scoreCandidate(
    cvText: string,
    jobPosition: ScoringJobPosition,
  ): Promise<ScoreResult | null> {
    const model = this.client.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `You are helping a recruiter evaluate a candidate's CV against a specific job opening.

Job title: ${jobPosition.title}
Job description: ${jobPosition.description}
Required skills: ${jobPosition.requiredSkills.join(', ') || 'none listed'}
Preferred skills: ${jobPosition.preferredSkills.join(', ') || 'none listed'}

Candidate CV text:
${cvText}

Score how well this CV matches the job (0-100), list which required/preferred skills the CV demonstrates and which are missing, and write a short 2-3 sentence recruiter-facing summary.

Respond with ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:
{"matchScore": <number 0-100>, "matchingSkills": ["..."], "missingSkills": ["..."], "summaryText": "..."}`;

    let raw: string;
    try {
      const result = await model.generateContent(prompt);
      raw = result.response.text().trim();
    } catch (error) {
      this.logger.warn(
        `Gemini scoring call failed: ${(error as Error).message}`,
      );
      return null;
    }

    try {
      return scoreResultSchema.parse(JSON.parse(stripCodeFence(raw)));
    } catch (error) {
      this.logger.warn(
        `Failed to parse Gemini scoring response (${(error as Error).message}): ${raw}`,
      );
      return null;
    }
  }
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
}
