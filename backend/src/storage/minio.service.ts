import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Minio.Client;
  private readonly logger = new Logger(MinioService.name);
  private readonly buckets = ['passidoc-documents', 'passidoc-logos'];

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: false,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit() {
    for (const bucket of this.buckets) {
      try {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket);
          this.logger.log(`Bucket créé : ${bucket}`);
        }
      } catch (err) {
        this.logger.warn(`MinIO non disponible ou bucket ${bucket} : ${err.message}`);
      }
    }
  }

  async uploadFile(bucket: string, objectName: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.putObject(bucket, objectName, buffer, buffer.length, { 'Content-Type': mimeType });
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.config.get<number>('MINIO_PORT', 9000);
    return `http://${endpoint}:${port}/${bucket}/${objectName}`;
  }

  async deleteFile(bucket: string, objectName: string): Promise<void> {
    try {
      await this.client.removeObject(bucket, objectName);
    } catch (err) {
      this.logger.warn(`Impossible de supprimer ${bucket}/${objectName} : ${err.message}`);
    }
  }

  async getStream(bucket: string, objectName: string) {
    return this.client.getObject(bucket, objectName);
  }
}
