import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '@ackplus/nest-auth';
import { Post } from './post.entity';

@Entity('users')
export class User extends BaseEntity {
  @ApiProperty({ 
    description: 'User email address (unique)',
    example: 'john@example.com'
  })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ 
    description: 'User first name',
    example: 'John'
  })
  @Column()
  firstName: string;

  @ApiProperty({ 
    description: 'User last name',
    example: 'Doe'
  })
  @Column()
  lastName: string;

  @ApiProperty({ 
    description: 'User password (hashed)',
    example: 'hashed_password_here'
  })
  @Column()
  password: string;

  @ApiProperty({ 
    description: 'Whether the user account is active',
    example: true,
    default: true
  })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ 
    description: 'User role',
    example: 'user',
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  })
  @Column({ default: 'user' })
  role: string;

  @ApiProperty({ 
    description: 'User posts',
    type: () => [Post],
    required: false
  })
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}

