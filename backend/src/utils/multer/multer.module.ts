// utils/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { MulterService } from './multer.service';

@Module({
  providers: [MulterService],
  exports: [MulterService],
})
export class MulterModule {}
