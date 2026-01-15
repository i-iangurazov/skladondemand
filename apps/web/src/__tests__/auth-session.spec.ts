import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  session: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

vi.mock('@qr/db', () => ({
  prisma: prismaMock,
  UserRole: { ADMIN: 'ADMIN', USER: 'USER' },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

vi.mock('bcryptjs', () => ({
  default: bcryptMock,
}));

import { POST as loginPost } from '../app/api/auth/login/route';
import { POST as logoutPost } from '../app/api/auth/logout/route';
import { POST as createCustomerPost } from '../app/api/admin/customers/route';
import { hashSessionToken } from '../lib/auth/session';

describe('auth session routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in and sets a session cookie', async () => {
    const user = {
      id: 'user-1',
      name: 'Test User',
      phone: '+996555123456',
      address: null,
      role: 'USER',
      isActive: true,
      passwordHash: 'hash',
    };

    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.session.create.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
    bcryptMock.compare.mockResolvedValue(true);

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user.phone, password: 'Password123' }),
    });

    const response = await loginPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.phone).toBe(user.phone);
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('session=');
    expect(setCookie).toContain('Max-Age=15552000');
  });

  it('rejects invalid credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+996555000000', password: 'Password123' }),
    });

    const response = await loginPost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.code).toBe('errors.invalidCredentials');
  });

  it('revokes session on logout', async () => {
    const token = 'token-123';
    const tokenHash = hashSessionToken(token);

    prismaMock.session.findFirst.mockResolvedValue({
      id: 'session-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      revokedAt: null,
      user: { id: 'user-1', isActive: true, role: 'USER' },
    });
    prismaMock.session.updateMany.mockResolvedValue({ count: 1 });

    const request = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { cookie: `session=${token}` },
    });

    const response = await logoutPost(request);

    expect(response.status).toBe(200);
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('Max-Age=0');
  });
});

describe('admin customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeAdminSession = (token: string) => {
    prismaMock.session.findFirst.mockResolvedValue({
      id: 'session-admin',
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      revokedAt: null,
      user: { id: 'admin-1', isActive: true, role: 'ADMIN' },
    });
  };

  it('creates a customer', async () => {
    const token = 'admin-token';
    makeAdminSession(token);

    prismaMock.user.create.mockResolvedValue({
      id: 'customer-1',
      name: 'Jane Doe',
      phone: '+996700000000',
      address: 'Main street',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    });
    bcryptMock.hash.mockResolvedValue('hashed');

    const request = new Request('http://localhost/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `session=${token}` },
      body: JSON.stringify({
        name: 'Jane Doe',
        phone: '+996700000000',
        address: 'Main street',
        password: 'Password123',
      }),
    });

    const response = await createCustomerPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.phone).toBe('+996700000000');
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  it('validates phone format', async () => {
    const token = 'admin-token-2';
    makeAdminSession(token);

    const request = new Request('http://localhost/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `session=${token}` },
      body: JSON.stringify({
        name: 'Jane Doe',
        phone: '0700000000',
        password: 'Password123',
      }),
    });

    const response = await createCustomerPost(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors[0].field).toBe('phone');
    expect(payload.errors[0].code).toBe('PHONE_INVALID');
  });
});
