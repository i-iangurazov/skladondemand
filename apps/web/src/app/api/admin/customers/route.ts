import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, Prisma, UserRole } from '@qr/db';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { isValidPhone } from '@/lib/auth/validation';

const PASSWORD_MIN_LENGTH = 8;
const NAME_MAX_LENGTH = 120;
const ADDRESS_MAX_LENGTH = 255;

type FieldError = { field: string; code: string; message: string };

const errorResponse = (errors: FieldError[], status = 400) =>
  NextResponse.json({ errors }, { status });

const generateTempPassword = () => randomBytes(8).toString('hex').slice(0, 10);

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { role: UserRole.USER },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse([{ field: 'form', code: 'INVALID_PAYLOAD', message: 'Invalid payload.' }], 400);
  }

  const name = readString((body as Record<string, unknown>).name);
  const phone = readString((body as Record<string, unknown>).phone);
  const addressInput = readString((body as Record<string, unknown>).address);
  const passwordInput = readString((body as Record<string, unknown>).password);

  const errors: FieldError[] = [];

  if (!name) {
    errors.push({ field: 'name', code: 'NAME_REQUIRED', message: 'Name is required.' });
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.push({ field: 'name', code: 'NAME_TOO_LONG', message: 'Name is too long.' });
  }

  if (!phone) {
    errors.push({ field: 'phone', code: 'PHONE_REQUIRED', message: 'Phone is required.' });
  } else if (!isValidPhone(phone)) {
    errors.push({
      field: 'phone',
      code: 'PHONE_INVALID',
      message: 'Phone must be in +996XXXXXXXXX format.',
    });
  }

  if (addressInput && addressInput.length > ADDRESS_MAX_LENGTH) {
    errors.push({ field: 'address', code: 'ADDRESS_TOO_LONG', message: 'Address is too long.' });
  }

  let password = passwordInput;
  let tempPassword: string | null = null;
  if (!password) {
    tempPassword = generateTempPassword();
    password = tempPassword;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push({
      field: 'password',
      code: 'PASSWORD_TOO_SHORT',
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }

  if (errors.length) {
    return errorResponse(errors, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        address: addressInput ? addressInput : null,
        passwordHash,
        role: UserRole.USER,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user, tempPassword: tempPassword ?? undefined });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(
        [{ field: 'phone', code: 'PHONE_TAKEN', message: 'Phone already exists.' }],
        409
      );
    }
    return errorResponse([{ field: 'form', code: 'UNKNOWN', message: 'Unable to create customer.' }], 500);
  }
}
