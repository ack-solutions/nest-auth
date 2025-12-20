import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '@ackplus/nest-auth';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    public repository: Repository<User>,
  ) {
    super(repository);
  }

  // Custom methods
  async findActiveUsers(): Promise<User[]> {
    return this.repository.find({
      where: { isActive: true },
      relations: ['posts'],
    });
  }

  async findByRole(role: string): Promise<User[]> {
    return this.repository.find({
      where: { role },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
    });
  }
}

