import { BadRequestException } from '@nestjs/common';

const EGYPTIAN_MOBILE_PATTERN = /^(?:\+20|0)?1[0125]\d{8}$/;

export function normalizeEgyptianMobilePhone(phone: string): string {
  if (!EGYPTIAN_MOBILE_PATTERN.test(phone)) {
    throw new BadRequestException('Enter a valid Egyptian mobile number');
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+2${digits}`;
  return `+20${digits}`;
}
