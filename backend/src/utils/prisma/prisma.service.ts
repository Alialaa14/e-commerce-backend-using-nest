import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService {
  private adapter: PrismaPg;
  public prisma: PrismaClient;
  constructor(private readonly configService: ConfigService) {
    this.adapter = new PrismaPg({
      connectionString: this.configService.get<string>('DB_URL'),
    });
    this.prisma = new PrismaClient({ adapter: this.adapter });
  }

  connectDB = async () => {
    try {
      await this.prisma.$connect();
      console.log('Connected to database');
    } catch (error) {
      console.log(error);
    }
  };
}
