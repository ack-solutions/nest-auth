import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { SeederService } from '@ackplus/nest-auth';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/database/entities/user.entity';
import { Post } from '../src/database/entities/post.entity';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let seederService: SeederService;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    seederService = moduleFixture.get<SeederService>(SeederService);
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    postRepository = moduleFixture.get<Repository<Post>>(getRepositoryToken(Post));

    // Clean database before each test
    await postRepository.delete({});
    await userRepository.delete({});
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('Database Seeding E2E', () => {
    it('should seed database through SeederService', async () => {
      // Run seeder
      await seederService.run();

      // Verify users were created
      const userCount = await userRepository.count();
      expect(userCount).toBeGreaterThan(0);

      // Verify posts were created
      const postCount = await postRepository.count();
      expect(postCount).toBeGreaterThan(0);
    });

    it('should create relationships between entities', async () => {
      await seederService.run();

      const posts = await postRepository.find({ relations: ['author'] });
      expect(posts.length).toBeGreaterThan(0);

      // Verify each post has an author
      posts.forEach(post => {
        expect(post.author).toBeDefined();
        expect(post.author.id).toBe(post.authorId);
        expect(post.author.email).toBeDefined();
      });
    });

    it('should create valid user data', async () => {
      await seederService.run();

      const users = await userRepository.find();
      expect(users.length).toBeGreaterThan(0);

      users.forEach(user => {
        // Check all required fields exist
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.firstName).toBeDefined();
        expect(user.lastName).toBeDefined();
        expect(user.password).toBeDefined();
        expect(user.role).toBeDefined();
        expect(typeof user.isActive).toBe('boolean');

        // Validate email format
        expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

        // Validate role
        expect(['user', 'admin', 'moderator']).toContain(user.role);
      });
    });

    it('should create valid post data', async () => {
      await seederService.run();

      const posts = await postRepository.find();
      expect(posts.length).toBeGreaterThan(0);

      posts.forEach(post => {
        // Check all required fields exist
        expect(post.id).toBeDefined();
        expect(post.title).toBeDefined();
        expect(post.content).toBeDefined();
        expect(post.status).toBeDefined();
        expect(post.authorId).toBeDefined();
        expect(typeof post.viewCount).toBe('number');
        expect(typeof post.published).toBe('boolean');

        // Validate status
        expect(['draft', 'published', 'archived']).toContain(post.status);

        // Validate viewCount range
        expect(post.viewCount).toBeGreaterThanOrEqual(0);
        expect(post.viewCount).toBeLessThanOrEqual(1000);
      });
    });

    it('should drop all data', async () => {
      // Seed first
      await seederService.run();
      expect(await userRepository.count()).toBeGreaterThan(0);
      expect(await postRepository.count()).toBeGreaterThan(0);

      // Drop
      await seederService.drop();

      // Verify all data is gone
      expect(await postRepository.count()).toBe(0);
      expect(await userRepository.count()).toBe(0);
    });

    it('should handle multiple seeding cycles', async () => {
      // First seed
      await seederService.run();
      const firstUserCount = await userRepository.count();
      const firstPostCount = await postRepository.count();

      // Drop
      await seederService.drop();

      // Second seed
      await seederService.run();
      const secondUserCount = await userRepository.count();
      const secondPostCount = await postRepository.count();

      // Should have same counts
      expect(secondUserCount).toBe(firstUserCount);
      expect(secondPostCount).toBe(firstPostCount);
    });

    it('should maintain data integrity across operations', async () => {
      await seederService.run();

      // Get all posts with authors
      const posts = await postRepository.find({ relations: ['author'] });
      
      // Verify no orphaned posts
      posts.forEach(post => {
        expect(post.author).toBeDefined();
        expect(post.authorId).toBe(post.author.id);
      });

      // Get all users with posts
      const users = await userRepository.find({ relations: ['posts'] });
      
      // Verify each user's posts reference them correctly
      users.forEach(user => {
        if (user.posts && user.posts.length > 0) {
          user.posts.forEach(post => {
            expect(post.authorId).toBe(user.id);
          });
        }
      });
    });
  });
});
