import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Crud } from '@ackplus/nest-auth';
import { Post } from '../database/entities/post.entity';
import { PostService } from './post.service';

@ApiTags('posts')
@Crud({
  entity: Post,
  routes: {
    findMany: true,
    findOne: true,
    create: true,
    update: true,
    delete: true,
  },
})
@Controller('posts')
export class PostController {
  constructor(public service: PostService) {}

  // Custom endpoints
  @Get('published')
  @ApiOperation({ 
    summary: 'Get all published posts',
    description: 'Returns all posts where published is true, including author information'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of published posts',
    type: [Post]
  })
  async getPublishedPosts(): Promise<Post[]> {
    return this.service.findPublishedPosts();
  }

  @Get('author/:authorId')
  @ApiOperation({ 
    summary: 'Get posts by author',
    description: 'Returns all posts created by the specified author'
  })
  @ApiParam({ 
    name: 'authorId', 
    description: 'Author ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of posts by the specified author',
    type: [Post]
  })
  async getPostsByAuthor(
    @Param('authorId', ParseIntPipe) authorId: number,
  ): Promise<Post[]> {
    return this.service.findByAuthor(authorId);
  }

  @Get('status/:status')
  @ApiOperation({ 
    summary: 'Get posts by status',
    description: 'Returns all posts with the specified status'
  })
  @ApiParam({ 
    name: 'status', 
    description: 'Post status (e.g., draft, published)',
    example: 'draft'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of posts with the specified status',
    type: [Post]
  })
  async getPostsByStatus(@Param('status') status: string): Promise<Post[]> {
    return this.service.findByStatus(status);
  }
}

