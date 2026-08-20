import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('job_positions')
export class JobPosition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'json' })
  requiredSkills!: string[];

  @Column({ type: 'json' })
  preferredSkills!: string[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 50 })
  skillsWeight!: number;

  @Column({ type: 'int', default: 30 })
  experienceWeight!: number;

  @Column({ type: 'int', default: 20 })
  educationWeight!: number;

  @Column({ type: 'text', nullable: true })
  customPromptTemplate!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
