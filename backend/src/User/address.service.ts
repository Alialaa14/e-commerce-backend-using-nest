import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { normalizeEgyptianMobilePhone } from './phone.util';

const ADDRESS_SELECT = {
  id: true,
  label: true,
  governorate: true,
  city: true,
  street: true,
  building: true,
  apartment: true,
  landmark: true,
  addressText: true,
  contactPhone: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface AddressFields {
  street: string;
  building?: string | null;
  apartment?: string | null;
  landmark?: string | null;
  city: string;
  governorate: string;
}

function formatAddressText(address: AddressFields): string {
  const parts = [
    address.street,
    address.building,
    address.apartment,
    address.landmark,
    address.city,
    address.governorate,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .filter(
      (part, index, values) =>
        values.findIndex(
          (value) => value.trim().toLowerCase() === part.trim().toLowerCase(),
        ) === index,
    );
  return parts.join(', ');
}

@Injectable()
export class AddressService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(userId: string) {
    return this.prismaService.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: ADDRESS_SELECT,
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    return this.prismaService.prisma.$transaction(async (tx) => {
      const existingAddress = await tx.address.findFirst({
        where: { userId },
        select: { id: true },
      });
      const isDefault = !existingAddress || dto.isDefault === true;

      if (isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const address = {
        ...dto,
        contactPhone: dto.contactPhone
          ? normalizeEgyptianMobilePhone(dto.contactPhone)
          : undefined,
      };

      return tx.address.create({
        data: {
          userId,
          ...address,
          addressText: formatAddressText(address),
          isDefault,
        },
        select: ADDRESS_SELECT,
      });
    });
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one address field is required');
    }

    return this.prismaService.prisma.$transaction(async (tx) => {
      const currentAddress = await tx.address.findFirst({
        where: { id: addressId, userId },
        select: {
          id: true,
          userId: true,
          label: true,
          governorate: true,
          city: true,
          street: true,
          building: true,
          apartment: true,
          landmark: true,
          addressText: true,
          contactPhone: true,
          latitude: true,
          longitude: true,
          isDefault: true,
        },
      });
      if (!currentAddress) throw new NotFoundException('Address not found');

      if (dto.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      const mergedAddress = { ...currentAddress, ...dto };
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...dto,
          ...(dto.contactPhone
            ? {
                contactPhone: normalizeEgyptianMobilePhone(dto.contactPhone),
              }
            : {}),
          addressText: formatAddressText(mergedAddress),
        },
        select: ADDRESS_SELECT,
      });
    });
  }

  async remove(userId: string, addressId: string) {
    return this.prismaService.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({
        where: { id: addressId, userId },
        select: { id: true, isDefault: true },
      });
      if (!address) throw new NotFoundException('Address not found');

      await tx.address.delete({ where: { id: addressId } });

      if (address.isDefault) {
        const replacement = await tx.address.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });
        if (replacement) {
          await tx.address.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }

      return { id: addressId };
    });
  }
}
