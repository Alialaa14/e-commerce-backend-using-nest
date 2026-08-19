import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { MultipartFile } from '@fastify/multipart';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';

@Injectable()
export class MulterService {
  private readonly baseDir = join(process.cwd(), 'uploads');
  private readonly allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
    file: MultipartFile,
    subfolder = 'general',
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.isAllowedMimeType(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype || 'unknown'}`,
      );
    }

    const dir = this.ensureDirectory(subfolder);
    const fileName = this.buildFileName(file.filename || 'upload');
    const filePath = join(dir, fileName);

    try {
      const buffer = await file.toBuffer();
      await writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
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
