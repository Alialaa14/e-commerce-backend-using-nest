import { Module } from '@nestjs/common';
import { SocketServices } from './socket.service';
import { TokenModule } from '../utils/Token/token.module';
import { RedisModule } from '../Redis/redis.module';
import { UserModule } from '../User/user.module';

@Module({
  exports: [],
  imports: [TokenModule, RedisModule, UserModule],
  providers: [SocketServices],
  controllers: [],
})
export class SocketModule {}
