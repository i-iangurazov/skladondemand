import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { normalizeCsvRows, parseCsvContent, suggestCsvMapping } from '@/lib/importer/csv';
import { checksumBuffer } from '@/lib/importer/staging';
import { createImportJob } from '@/lib/importer/jobs';
import { checkRateLimit } from '@/lib/rateLimit';
import { logAdminAction } from '@/lib/audit';
import type { CsvMapping, ImportParseResult } from '@/lib/importer/types';
import { ImportSourceType } from '@qr/db';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CSV_MIME = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];

const isCsvFile = (file: File) =>
  file.name.toLowerCase().endsWith('.csv') || CSV_MIME.includes(file.type);

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit({
    key: `import:parse-csv:${auth.user.id}`,
    limit: 10,
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
  const mappingRaw = formData.get('mapping');

  if (!(file instanceof File)) {
    return NextResponse.json({ code: 'errors.invalidFile' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ code: 'errors.fileTooLarge' }, { status: 413 });
  }

  if (!isCsvFile(file)) {
    return NextResponse.json({ code: 'errors.unsupportedFile' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = checksumBuffer(buffer);

  const text = buffer.toString('utf-8');
  const parsed = parseCsvContent(text);

  let mapping: CsvMapping;
  if (mappingRaw) {
    try {
      mapping = JSON.parse(String(mappingRaw)) as CsvMapping;
    } catch {
      return NextResponse.json({ code: 'errors.invalidMapping' }, { status: 400 });
    }
  } else {
    mapping = suggestCsvMapping(parsed.headers, 'retail');
  }
  const normalized = normalizeCsvRows({ headers: parsed.headers, rows: parsed.rows, mapping });

  const job = await createImportJob({
    userId: auth.user.id,
    sourceType: ImportSourceType.CSV,
    checksum,
    fileName: file.name,
    fileSize: file.size,
    rows: normalized.rows,
    warnings: [...parsed.warnings, ...normalized.warnings],
    errors: normalized.errors,
    csv: { headers: parsed.headers, delimiter: parsed.delimiter, mapping },
  });

  await logAdminAction({
    userId: auth.user.id,
    action: 'import.parse.csv',
    importJobId: job.id,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      rows: normalized.rows.length,
    },
  });

  const result: ImportParseResult = {
    importId: job.id,
    rows: normalized.rows,
    warnings: [...parsed.warnings, ...normalized.warnings],
    errors: normalized.errors,
    checksum,
    columns: parsed.headers,
    mapping,
    needsReviewCount: 0,
    totalRows: normalized.rows.length,
    sourceType: 'csv',
  };

  return NextResponse.json(result);
}
