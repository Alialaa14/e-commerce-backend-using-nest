import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UploadedFastifyFile = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.uploadedFile;
  },
);
