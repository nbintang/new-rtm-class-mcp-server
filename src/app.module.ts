import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { McpModule } from '@nestjs-mcp/server';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { DbResolver } from './db/db.resolver';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    McpModule.forRoot({
      name: 'RTM Class AI MCP Server',
      version: '1.0.0',
      transports: {
        sse: { enabled: true }
      }
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, DbResolver],
})
export class AppModule {}
