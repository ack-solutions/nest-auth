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

@Entity('nest_auth_admin_users')
export class AdminUser extends BaseEntity {
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

  private static argon2Loader: Promise<typeof import('argon2')> | null = null;

  private static async getArgon2(): Promise<typeof import('argon2')> {
    if (!AdminUser.argon2Loader) {
      AdminUser.argon2Loader = import('argon2').catch((error) => {
        throw new Error(
          `argon2 native module is not available. ` +
            `Install/build argon2 before using password hashing. ` +
            `Original error: ${error?.message ?? error}`
        );
      }) as Promise<typeof import('argon2')>;
    }
    return AdminUser.argon2Loader;
  }

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
    const argon2 = await AdminUser.getArgon2();
    this.passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
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
      const argon2 = await AdminUser.getArgon2();
      return await argon2.verify(this.passwordHash, password);
    } catch {
      return false;
    }
  }
}
