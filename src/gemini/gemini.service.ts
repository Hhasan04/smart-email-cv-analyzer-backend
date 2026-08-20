import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const MODEL_NAME = 'gemini-3.6-flash';

const matchResultSchema = z.object({
  jobPositionId: z.string().nullable(),
});

const scoreBreakdownSchema = z.object({
  skillsScore: z.number().min(0).max(100),
  experienceScore: z.number().min(0).max(100),
  educationScore: z.number().min(0).max(100),
});

const scoreResultSchema = z.object({
  matchScore: z.number().min(0).max(100),
  matchingSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  summaryText: z.string(),
  scoreBreakdown: scoreBreakdownSchema.optional(),
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
  skillsWeight: number;
  experienceWeight: number;
  educationWeight: number;
  customPromptTemplate: string | null;
}

export type ScoreResult = z.infer<typeof scoreResultSchema>;

const RESPONSE_FORMAT_INSTRUCTIONS = `Respond with ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:
{"matchScore": <number 0-100>, "matchingSkills": ["..."], "missingSkills": ["..."], "summaryText": "...", "scoreBreakdown": {"skillsScore": <0-100>, "experienceScore": <0-100>, "educationScore": <0-100>}}`;

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

    const model = this.client.getGenerativeModel({ model: MODEL_NAME });
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
    const model = this.client.getGenerativeModel({ model: MODEL_NAME });
    const prompt = this.buildScoringPrompt(cvText, jobPosition);

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

  private buildScoringPrompt(
    cvText: string,
    jobPosition: ScoringJobPosition,
  ): string {
    const criteria = jobPosition.customPromptTemplate
      ? this.fillTemplate(jobPosition.customPromptTemplate, cvText, jobPosition)
      : this.buildDefaultCriteria(cvText, jobPosition);

    return `${criteria}\n\n${RESPONSE_FORMAT_INSTRUCTIONS}`;
  }

  private buildDefaultCriteria(
    cvText: string,
    jobPosition: ScoringJobPosition,
  ): string {
    return `You are helping a recruiter evaluate a candidate's CV against a specific job opening.

Job title: ${jobPosition.title}
Job description: ${jobPosition.description}
Required skills: ${jobPosition.requiredSkills.join(', ') || 'none listed'}
Preferred skills: ${jobPosition.preferredSkills.join(', ') || 'none listed'}

Candidate CV text:
${cvText}

Score how well this CV matches the job (0-100), weighting your assessment as: skills ${jobPosition.skillsWeight}%, experience ${jobPosition.experienceWeight}%, education ${jobPosition.educationWeight}%. List which required/preferred skills the CV demonstrates and which are missing, provide a per-criterion breakdown score (0-100 each for skills/experience/education), and write a short 2-3 sentence recruiter-facing summary.`;
  }

  private fillTemplate(
    template: string,
    cvText: string,
    jobPosition: ScoringJobPosition,
  ): string {
    const values: Record<string, string> = {
      jobTitle: jobPosition.title,
      jobDescription: jobPosition.description,
      requiredSkills: jobPosition.requiredSkills.join(', ') || 'none listed',
      preferredSkills: jobPosition.preferredSkills.join(', ') || 'none listed',
      cvText,
      skillsWeight: String(jobPosition.skillsWeight),
      experienceWeight: String(jobPosition.experienceWeight),
      educationWeight: String(jobPosition.educationWeight),
    };

    return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
      key in values ? values[key] : match,
    );
  }
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
}
