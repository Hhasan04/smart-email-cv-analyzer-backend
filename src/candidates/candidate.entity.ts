import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JobPosition } from '../job-positions/job-position.entity';

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

  @Column({ type: 'varchar', nullable: true })
  jobPositionId: string | null;

  @ManyToOne(() => JobPosition, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'jobPositionId' })
  jobPosition: JobPosition | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
