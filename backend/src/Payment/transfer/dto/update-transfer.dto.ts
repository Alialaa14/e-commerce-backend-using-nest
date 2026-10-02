import {
  IsObject,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isStringRecord', async: false })
class IsStringRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'string')
    );
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'metadata values must all be strings';
  }
}

export class UpdateTransferDto {
  @IsObject()
  @Validate(IsStringRecordConstraint)
  metadata!: Record<string, string>;
}
