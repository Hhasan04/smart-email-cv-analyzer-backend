import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Candidate } from '../candidates/candidate.entity';

@Entity('cv_analyses')
export class CVAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  candidateId!: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidateId' })
  candidate!: Candidate;

  @Column({ type: 'float' })
  matchScore!: number;

  @Column({ type: 'json' })
  matchingSkills!: string[];

  @Column({ type: 'json' })
  missingSkills!: string[];

  @Column({ type: 'text' })
  summaryText!: string;

  @Column({ type: 'json', nullable: true })
  scoreBreakdown!: {
    skillsScore: number;
    experienceScore: number;
    educationScore: number;
  } | null;

  @CreateDateColumn()
  createdAt!: Date;
}
