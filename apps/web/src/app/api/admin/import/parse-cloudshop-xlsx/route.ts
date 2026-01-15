import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { parseCloudshopWorkbook } from '@/lib/importer/cloudshop';
import { checksumBuffer } from '@/lib/importer/staging';
import { createImportJob } from '@/lib/importer/jobs';
import { checkRateLimit } from '@/lib/rateLimit';
import { logAdminAction } from '@/lib/audit';
import type { ImportParseResult } from '@/lib/importer/types';
import { ImportSourceType } from '@qr/db';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const XLSX_MIME = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

const isXlsxFile = (file: File) => {
  const hasExtension = file.name.toLowerCase().endsWith('.xlsx');
  if (!hasExtension) return false;
  if (!file.type) return true;
  return XLSX_MIME.includes(file.type);
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit({
    key: `import:parse-cloudshop-xlsx:${auth.user.id}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { code: 'errors.rateLimited' },
      {
        status: 429,
        headers: { 'Retry-After': Math.ceil(rate.retryAfterMs / 1000).toString() },
      }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ code: 'errors.invalidPayload' }, { status: 400 });
  }

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ code: 'errors.invalidFile' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ code: 'errors.fileTooLarge' }, { status: 413 });
  }

  if (!isXlsxFile(file)) {
    return NextResponse.json({ code: 'errors.unsupportedFile' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = checksumBuffer(buffer);

  const parsed = parseCloudshopWorkbook(buffer);
  const needsReviewCount = parsed.rows.filter((row) => row.source?.needsReview).length;

  const job = await createImportJob({
    userId: auth.user.id,
    sourceType: ImportSourceType.CLOUDSHOP_XLSX,
    checksum,
    fileName: file.name,
    fileSize: file.size,
    rows: parsed.rows,
    warnings: parsed.warnings,
    errors: parsed.errors,
    mapping: {
      preset: 'cloudshop-xlsx',
      columns: parsed.columns,
    },
  });

  await logAdminAction({
    userId: auth.user.id,
    action: 'import.parse.cloudshop',
    importJobId: job.id,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      rows: parsed.rows.length,
      needsReviewCount,
    },
  });

  const result: ImportParseResult = {
    importId: job.id,
    rows: parsed.rows,
    warnings: parsed.warnings,
    errors: parsed.errors,
    checksum,
    columns: parsed.columns,
    needsReviewCount,
    totalRows: parsed.rows.length,
    sourceType: 'cloudshop-xlsx',
  };

  return NextResponse.json(result);
}
