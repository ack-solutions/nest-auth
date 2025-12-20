// seeder.config.js - Configuration for nest-seed CLI
const { TypeOrmModule } = require('@nestjs/typeorm');
const { User } = require('./src/database/entities/user.entity');
const { Post } = require('./src/database/entities/post.entity');
const { UserSeeder } = require('./src/database/seeders/user.seeder');
const { PostSeeder } = require('./src/database/seeders/post.seeder');

module.exports = {
  imports: [
    // Database configuration
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [User, Post],
      synchronize: true,
      logging: false,
    }),
    
    // Entity repositories
    TypeOrmModule.forFeature([User, Post]),
  ],
  
  // Seeders to run (in order)
  seeders: [
    UserSeeder,  // Run first
    PostSeeder,  // Run second (depends on users)
  ],
};

