import { PrismaClient } from '@prisma/client';

const globalForErp = globalThis as unknown as { erpDb?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.ERP_DATABASE_URL;
  if (!url) {
    return new PrismaClient();
  }
  return new PrismaClient({
    datasources: { db: { url } },
  });
}

export const erpDb = globalForErp.erpDb ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForErp.erpDb = erpDb;

export function resolveErpImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  if (image.startsWith('/')) {
    const base = (process.env.ERP_BASE_URL || 'https://erpzahialga.com').replace(/\/$/, '');
    return base + image;
  }
  return image;
}
