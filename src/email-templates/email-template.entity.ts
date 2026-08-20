import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EmailTemplateType {
  OUTREACH = 'OUTREACH',
  REJECTION = 'REJECTION',
}

@Entity('email_templates')
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: EmailTemplateType })
  type: EmailTemplateType;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  bodyTemplate: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
