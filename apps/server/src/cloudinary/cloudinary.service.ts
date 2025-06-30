// cloudinary.service.ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import toStream = require('buffer-to-stream');

@Injectable()
export class CloudinaryService {
  async uploadImage(file: Express.Multer.File): Promise<{ url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'idest' },
        (error, result) => {
          if (error) return reject(error);
          if (result) {
            resolve({ url: result.secure_url, public_id: result.public_id });
          } else {
            reject(new Error('No result returned from Cloudinary.'));
          }
        },
      );
      toStream(file.buffer).pipe(upload);
    });
  }

  async uploadImageFromUrl(url: string): Promise<{ url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        url,
        { folder: 'idest' },
        (error, result) => {
          if (error) return reject(error);
          if (result) {
            resolve({ url: result.secure_url, public_id: result.public_id });
          } else {
            reject(new Error('No result returned from Cloudinary.'));
          }
        },
      );
    });
  }

  async deleteImage(public_id: string): Promise<void> {
    await cloudinary.uploader.destroy(public_id);
  }
}
