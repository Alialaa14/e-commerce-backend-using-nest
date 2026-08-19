import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrandModule } from './Brand/brand.module';
import { CategoryModule } from './Category/category.module';
import { UserModule } from './User/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UserModule,
    BrandModule,
    CategoryModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
