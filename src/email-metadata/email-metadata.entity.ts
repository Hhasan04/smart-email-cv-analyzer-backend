import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EmailStatus {
  PENDING = 'PENDING',
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

  @CreateDateColumn()
  createdAt!: Date;
}
