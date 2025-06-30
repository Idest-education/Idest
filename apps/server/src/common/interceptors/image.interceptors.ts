import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class ImageInterceptor implements NestInterceptor {
  constructor(private readonly cloudinary: CloudinaryService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();

    if (!req.file) return next.handle(); // no file? skip

    try {
      const result = await this.cloudinary.uploadImage(req.file);
      req.body.imageUrl = result.url;
      req.body.imagePublicId = result.public_id;

      const oldPublicId = req.user.avatar_url; // Assuming user avatar URL is stored in req.user.avatar_url
      if (oldPublicId) {
        await this.cloudinary.deleteImage(oldPublicId);
        console.log('Deleted old Cloudinary image:', oldPublicId);
      }

      return next.handle().pipe(
        catchError(async (err) => {
          // Rollback if downstream throws
          await this.cloudinary.deleteImage(result.public_id);
          throw err;
        }),
      );
    } catch (err) {
      throw err;
    }
  }
}
