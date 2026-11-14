import { BadRequestException } from '@nestjs/common';
import { MulterService } from '../utils/multer/multer.service';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';

export interface DeliveryImageFile {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export async function uploadDeliveryImage(
  file: DeliveryImageFile | undefined,
  folder: string,
  multerService: MulterService,
  cloudinaryService: CloudinaryService,
) {
  const allowedTypes = new Set(['image/jpeg', 'image/png']);
  if (!file || !allowedTypes.has(file.mimetype)) {
    throw new BadRequestException('A JPEG or PNG image is required');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new BadRequestException('Image size must not exceed 5MB');
  }
  const isPng =
    file.mimetype === 'image/png' &&
    file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg =
    file.mimetype === 'image/jpeg' &&
    file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (!isPng && !isJpeg) {
    throw new BadRequestException('Image content does not match its file type');
  }

  const filePath = await multerService.saveToDisk(file, 'delivery');
  try {
    return await cloudinaryService.uploadToCloudinary(filePath, folder);
  } finally {
    await multerService.deleteFile(filePath);
  }
}
