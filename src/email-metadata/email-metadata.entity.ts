import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Candidate } from '../candidates/candidate.entity';

export enum EmailStatus {
  PENDING = 'PENDING',
  PENDING_CV_ANALYSIS = 'PENDING_CV_ANALYSIS',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  IGNORED = 'IGNORED',
}

@Entity('email_metadata')
export class EmailMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  messageId!: string;

  @Column()
  senderEmail!: string;

  @Column()
  subject!: string;

  @Column({ type: 'text' })
  bodyText!: string;

  @Column()
  receivedAt!: Date;

  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.PENDING })
  status!: EmailStatus;

  @Column({ type: 'varchar', nullable: true })
  candidateId!: string | null;

  @ManyToOne(() => Candidate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'candidateId' })
  candidate!: Candidate | null;

  @CreateDateColumn()
  createdAt!: Date;
}
