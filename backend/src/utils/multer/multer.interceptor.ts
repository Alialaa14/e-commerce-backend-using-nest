import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FastifyRequest } from 'fastify';

@Injectable()
export class FastifyFileInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();

    if (!req.isMultipart()) {
      (req as any).uploadedFile = undefined;
      (req as any).parsedFields = {};
      return next.handle();
    }

    let uploadedFile: any;
    const fields: Record<string, string> = {};

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        uploadedFile = {
          filename: part.filename,
          mimetype: part.mimetype,
          fieldname: part.fieldname,
          buffer,
        };
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    (req as any).uploadedFile = uploadedFile;
    (req as any).parsedFields = fields;

    return next.handle();
  }
}
