import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '@ackplus/nest-auth';
import { User } from './user.entity';

@Entity('posts')
export class Post extends BaseEntity {
  @ApiProperty({ 
    description: 'Post title',
    example: 'My First Post'
  })
  @Column()
  title: string;

  @ApiProperty({ 
    description: 'Post content',
    example: 'This is the content of my first post...'
  })
  @Column('text')
  content: string;

  @ApiProperty({ 
    description: 'Post status',
    example: 'draft',
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  })
  @Column({ default: 'draft' })
  status: string;

  @ApiProperty({ 
    description: 'Author ID',
    example: 1
  })
  @Column()
  authorId: number;

  @ApiProperty({ 
    description: 'Post author',
    type: () => User,
    required: false
  })
  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @ApiProperty({ 
    description: 'Number of views',
    example: 0,
    default: 0
  })
  @Column({ default: 0 })
  viewCount: number;

  @ApiProperty({ 
    description: 'Whether the post is published',
    example: true,
    default: true
  })
  @Column({ default: true })
  published: boolean;
}

