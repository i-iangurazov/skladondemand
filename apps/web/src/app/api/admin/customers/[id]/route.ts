import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma, UserRole } from '@qr/db';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const PASSWORD_MIN_LENGTH = 8;
const NAME_MAX_LENGTH = 120;
const ADDRESS_MAX_LENGTH = 255;

type FieldError = { field: string; code: string; message: string };

const errorResponse = (errors: FieldError[], status = 400) =>
  NextResponse.json({ errors }, { status });

const readOptionalString = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);
const readOptionalBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const userId = context.params.id;
  if (!userId) {
    return errorResponse([{ field: 'id', code: 'ID_REQUIRED', message: 'Customer id is required.' }], 400);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse([{ field: 'form', code: 'INVALID_PAYLOAD', message: 'Invalid payload.' }], 400);
  }

  const name = readOptionalString((body as Record<string, unknown>).name);
  const address = readOptionalString((body as Record<string, unknown>).address);
  const isActive = readOptionalBoolean((body as Record<string, unknown>).isActive);
  const password = readOptionalString((body as Record<string, unknown>).password);

  const errors: FieldError[] = [];

  if (name !== undefined) {
    if (!name) {
      errors.push({ field: 'name', code: 'NAME_REQUIRED', message: 'Name is required.' });
    } else if (name.length > NAME_MAX_LENGTH) {
      errors.push({ field: 'name', code: 'NAME_TOO_LONG', message: 'Name is too long.' });
    }
  }

  if (address !== undefined && address.length > ADDRESS_MAX_LENGTH) {
    errors.push({ field: 'address', code: 'ADDRESS_TOO_LONG', message: 'Address is too long.' });
  }

  if (password !== undefined) {
    if (!password) {
      errors.push({ field: 'password', code: 'PASSWORD_REQUIRED', message: 'Password is required.' });
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      errors.push({
        field: 'password',
        code: 'PASSWORD_TOO_SHORT',
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      });
    }
  }

  if (name === undefined && address === undefined && isActive === undefined && password === undefined) {
    errors.push({ field: 'form', code: 'NO_FIELDS', message: 'No fields to update.' });
  }

  if (errors.length) {
    return errorResponse(errors, 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!existing || existing.role !== UserRole.USER) {
    return errorResponse([{ field: 'id', code: 'NOT_FOUND', message: 'Customer not found.' }], 404);
  }

  const data: {
    name?: string;
    address?: string | null;
    isActive?: boolean;
    passwordHash?: string;
  } = {};

  if (name !== undefined) data.name = name;
  if (address !== undefined) data.address = address ? address : null;
  if (isActive !== undefined) data.isActive = isActive;
  if (password !== undefined) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}
