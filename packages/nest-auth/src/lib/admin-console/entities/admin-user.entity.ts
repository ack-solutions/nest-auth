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
import { assertPasswordPolicy } from '../../utils/password-policy.util';
import { normalizedEmail } from '../../utils';

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

  /**
   * Bumped to revoke this admin's outstanding session tokens (logout, password
   * reset). The session JWT carries the version it was minted at; the guard
   * rejects a token whose version no longer matches — making the otherwise
   * stateless admin sessions revocable.
   */
  @Column({ default: 0 })
  tokenVersion: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


  @BeforeInsert()
  normalizeEmail() {
    if (this.email) {
      this.email = normalizedEmail(this.email) ?? this.email;
    }
  }

  @BeforeUpdate()
  normalizeEmailOnUpdate() {
    if (this.email) {
      this.email = normalizedEmail(this.email) ?? this.email;
    }
  }

  async setPassword(password: string): Promise<void> {
    // Hold admin-console passwords to the same (opt-in) policy as user passwords.
    await assertPasswordPolicy(password, { email: this.email });
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
