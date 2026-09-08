import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Minio.Client;
  private readonly logger = new Logger(MinioService.name);
  private readonly buckets = ['passidoc-documents', 'passidoc-logos'];
  private useLocal = false;
  private readonly localRoot: string;

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.localRoot = path.join(process.cwd(), 'uploads');
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
        this.logger.warn(`MinIO non disponible (${err.message}) — stockage local activé dans ./uploads`);
        this.useLocal = true;
        fs.mkdirSync(this.localRoot, { recursive: true });
        break;
      }
    }
  }

  async uploadFile(bucket: string, objectName: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (this.useLocal) {
      const fileName = objectName.replace(/\//g, '_');
      const filePath = path.join(this.localRoot, fileName);
      fs.writeFileSync(filePath, buffer);
      const apiBase = this.config.get<string>('API_BASE_URL', 'http://localhost:3000');
      return `${apiBase}/uploads/${fileName}`;
    }
    await this.client.putObject(bucket, objectName, buffer, buffer.length, { 'Content-Type': mimeType });
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.config.get<number>('MINIO_PORT', 9000);
    return `http://${endpoint}:${port}/${bucket}/${objectName}`;
  }

  async deleteFile(bucket: string, objectName: string): Promise<void> {
    if (this.useLocal) {
      const filePath = path.join(this.localRoot, objectName.replace(/\//g, '_'));
      try { fs.unlinkSync(filePath); } catch { /* silent */ }
      return;
    }
    try {
      await this.client.removeObject(bucket, objectName);
    } catch (err) {
      this.logger.warn(`Impossible de supprimer ${bucket}/${objectName} : ${err.message}`);
    }
  }

  async getStream(bucket: string, objectName: string): Promise<Readable> {
    if (this.useLocal) {
      const filePath = path.join(this.localRoot, objectName.replace(/\//g, '_'));
      if (!fs.existsSync(filePath)) throw new Error(`Fichier non trouvé : ${objectName}`);
      return fs.createReadStream(filePath);
    }
    return this.client.getObject(bucket, objectName);
  }
}
