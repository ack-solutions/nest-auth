import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { hash, verify, Algorithm } from '@node-rs/argon2';

@Entity('nest_auth_admin_users')
export class NestAuthAdminUser extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ nullable: true })
  name?: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'simple-json', nullable: true, default: '{}' })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


  @BeforeInsert()
  normalizeEmail() {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }

  @BeforeUpdate()
  normalizeEmailOnUpdate() {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }

  async setPassword(password: string): Promise<void> {
    this.passwordHash = await hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.passwordHash) {
      return false;
    }
    try {
      return await verify(this.passwordHash, password);
    } catch {
      return false;
    }
  }
}
