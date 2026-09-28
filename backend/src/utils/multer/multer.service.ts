import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';

interface UploadedFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class MulterService {
  private readonly baseDir = join(process.cwd(), 'uploads');
  private readonly allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ]);

  isAllowedMimeType(mimeType: string): boolean {
    return this.allowedMimeTypes.has(mimeType);
  }

  private ensureDirectory(subfolder: string): string {
    const dir = join(this.baseDir, subfolder);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private buildFileName(originalName: string): string {
    const safeName = (originalName || 'upload')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');

    const extension = extname(safeName) || '.bin';
    const baseName =
      safeName.slice(0, Math.max(0, safeName.length - extension.length)) ||
      'file';
    return `${Date.now()}-${baseName}${extension}`;
  }

  async saveToDisk(
    file: UploadedFile | undefined,
    subfolder = 'general',
  ): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.isAllowedMimeType(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype || 'unknown'}`,
      );
    }

    const dir = this.ensureDirectory(subfolder);
    const fileName = this.buildFileName(file.filename || 'uploads');
    const filePath = join(dir, fileName);

    try {
      await writeFile(filePath, file.buffer);
      return filePath;
    } catch (error) {
      console.log(`Write file error: ${(error as Error).message}`);
      throw new InternalServerErrorException(
        `Failed to save uploaded file: ${(error as Error).message}`,
      );
    }
  }

  async deleteFile(filePath?: string): Promise<void> {
    if (!filePath) return;

    try {
      unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to delete ${filePath}:`, (error as Error).message);
    }
  }
}
