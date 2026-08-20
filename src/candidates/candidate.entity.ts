import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JobPosition } from '../job-positions/job-position.entity';
import { CVAnalysis } from '../cv-analysis/cv-analysis.entity';
import { EmailMetadata } from '../email-metadata/email-metadata.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  parsedCvText: string | null;

  @Column({ type: 'mediumblob', nullable: true, select: false })
  resumeFile: Buffer | null;

  @Column({ type: 'varchar', nullable: true })
  resumeFileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  jobPositionId: string | null;

  @ManyToOne(() => JobPosition, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'jobPositionId' })
  jobPosition: JobPosition | null;

  @OneToMany(() => CVAnalysis, (analysis) => analysis.candidate)
  cvAnalyses: CVAnalysis[];

  @OneToMany(() => EmailMetadata, (email) => email.candidate)
  emailMetadata: EmailMetadata[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
