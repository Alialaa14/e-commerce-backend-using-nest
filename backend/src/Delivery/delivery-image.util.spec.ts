import { BadRequestException } from '@nestjs/common';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { MulterService } from '../utils/multer/multer.service';
import { DeliveryImageFile, uploadDeliveryImage } from './delivery-image.util';

describe('uploadDeliveryImage', () => {
  const pngFile = (): DeliveryImageFile => ({
    filename: 'proof.png',
    mimetype: 'image/png',
    size: 8,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });

  it('rejects image content that does not match the declared MIME type', async () => {
    const file = {
      ...pngFile(),
      buffer: Buffer.from('not a PNG'),
    };
    const saveToDisk = jest.fn();
    const multerService = {
      saveToDisk,
      deleteFile: jest.fn(),
    } as unknown as MulterService;
    const uploadToCloudinary = jest.fn();
    const cloudinaryService = {
      uploadToCloudinary,
    } as unknown as CloudinaryService;

    await expect(
      uploadDeliveryImage(
        file,
        'delivery/proofs',
        multerService,
        cloudinaryService,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saveToDisk).not.toHaveBeenCalled();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('accepts a PNG with a matching file signature', async () => {
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const multerService = {
      saveToDisk: jest.fn().mockResolvedValue('proof.png'),
      deleteFile,
    } as unknown as MulterService;
    const cloudinaryService = {
      uploadToCloudinary: jest.fn().mockResolvedValue({
        secure_url: 'https://cloud.example/proof.png',
        public_id: 'proof',
      }),
    } as unknown as CloudinaryService;

    await expect(
      uploadDeliveryImage(
        pngFile(),
        'delivery/proofs',
        multerService,
        cloudinaryService,
      ),
    ).resolves.toEqual({
      secure_url: 'https://cloud.example/proof.png',
      public_id: 'proof',
    });
    expect(deleteFile).toHaveBeenCalledWith('proof.png');
  });
});
