import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '@ackplus/nest-auth';
import { Post } from '../database/entities/post.entity';

@Injectable()
export class PostService extends CrudService<Post> {
  constructor(
    @InjectRepository(Post)
    public repository: Repository<Post>,
  ) {
    super(repository);
  }

  // Custom methods
  async findPublishedPosts(): Promise<Post[]> {
    return this.repository.find({
      where: { published: true },
      relations: ['author'],
    });
  }

  async findByAuthor(authorId: number): Promise<Post[]> {
    return this.repository.find({
      where: { authorId },
      relations: ['author'],
    });
  }

  async findByStatus(status: string): Promise<Post[]> {
    return this.repository.find({
      where: { status },
    });
  }
}

