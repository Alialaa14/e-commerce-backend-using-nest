// token.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

@Module({
  imports: [ConfigModule, JwtModule.register({})], // empty — secrets supplied per sign/verify call
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
