import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { Server as IOServer } from 'socket.io';
import crypto from 'node:crypto';
import * as QRCode from 'qrcode';
import type {
  Prisma as PrismaClientNamespace,
  MenuChangeEvent as DbMenuChangeEvent,
  MenuModifierGroup as DbMenuModifierGroup,
  MenuModifierOption as DbMenuModifierOption,
  Venue as DbVenue,
} from '@qr/db';
import {
  FRONTEND_BASE_URL,
  SESSION_INACTIVITY_MS,
  CLOSED_SESSION_TTL_MS,
  SERVED_ORDER_TTL_MS,
  DEMO_STAFF_PASSWORD,
  corsAllowedOrigins,
  corsAllowLocalhost,
  refreshCookieName,
  refreshCookieDomain,
  refreshCookiePath,
  refreshCookieSameSite,
  refreshCookieSecure,
  refreshTokenTtlDays,
  authRateLimitMax,
  authRateLimitWindowMs,
  platformOwnerEmail,
  platformOwnerPassword,
} from './config/env';
import { parseBearerToken, verifyStaffJwt, issueStaffAccessToken, verifyPlatformJwt, issuePlatformAccessToken } from './lib/authTokens';
import type { StaffTokenPayload, PlatformTokenPayload } from './lib/authTokens';
import { generateTempPassword, hashPassword, isPasswordStrong, verifyPassword } from './lib/crypto';
import { createStaffService, mapStaffUser } from './lib/staffService';
import { createPlatformService, mapPlatformUser } from './lib/platformService';
import { buildPageInfo, parsePageParams } from './lib/pagination';
import { computeRequestHash, getIdempotencyKey, withIdempotency } from './lib/idempotency';
import { z } from 'zod';

// Defer Prisma import until after env is loaded to ensure it picks up the correct DATABASE_URL.
const prismaModulePromise = import('@qr/db');
type PrismaModule = Awaited<typeof prismaModulePromise>;
let prisma: PrismaModule['prisma'];
let Prisma: PrismaModule['Prisma'];
let staffService: ReturnType<typeof createStaffService>;
let platformService: ReturnType<typeof createPlatformService>;
import {
  AdminMenuItemCreateDto,
  AdminMenuItemUpdateDto,
  AdminTableCreateDto,
  AdminTableUpdateDto,
  AssistanceRequestDto,
  AuthLoginDto,
  AuthLoginResponseDto,
  AuthRefreshResponseDto,
  CartAddItemDto,
  CartRemoveItemDto,
  CartUpdateItemQtyDto,
  CartUpdatedEventDto,
  ErrorEventDto,
  GuestPingDto,
  JoinSessionDto,
  JoinSessionResponseDto,
  JoinSessionSocketDto,
  MenuChangeEventDto,
  MenuChangeEventsResponseDto,
  MenuUpdatedEventDto,
  OrderEventDto,
  OrderMarkServedDto,
  OrderStatusEnum,
  OrderSubmitDto,
  PaymentCreateDto,
  PaymentCreateResponseDto,
  PaymentStatusEnum,
  PaymentUpdatedEventDto,
  PublicMenuResponseDto,
  SessionLeaveDto,
  SessionStateDto,
  SessionStateEventDto,
  PlatformAuthLoginDto,
  PlatformAuthLoginResponseDto,
  OwnerVenueDto,
  OwnerVenueCreateDto,
  OwnerVenueUpdateDto,
  OwnerTableDto,
  OwnerTableCreateDto,
  OwnerTableUpdateDto,
  OwnerBulkTableCreateDto,
  OwnerStaffCreateDto,
  OwnerStaffUpdateDto,
  OwnerStatsDto,
  StaffCreateDto,
  StaffOrderStatusPatchDto,
  StaffOrdersQueryDto,
  StaffOrdersResponseDto,
  StaffUpdateDto,
  StaffUserDto,
  TableSessionStatusEnum,
  UserRoleEnum,
  WaiterSubscribeDto,
  isOrderTransitionAllowed,
  PaymentQuoteRequestDto,
  PaymentQuoteResponseDto,
  type CartItem,
  type MenuItem,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentIntent,
  type MenuModifierGroup,
  type TableSession,
} from '@qr/types';

const demoVenue = {
  id: 'venue-demo',
  name: 'Demo Venue',
  slug: 'demo',
  currency: 'KGS',
  timezone: 'Asia/Bishkek',
};

const demoMenu = PublicMenuResponseDto.parse({
  venue: demoVenue,
  categories: [
    {
      id: 'cat-mains',
      name: 'Основное',
      sortOrder: 0,
      items: [
        {
          id: 'item-plov',
          name: 'Плов',
          description: 'Рис, морковь, баранина',
          price: 35000,
          isActive: true,
          isInStock: true,
          sortOrder: 0,
          modifiers: [
            {
              id: 'mod-sauce',
              name: 'Соус',
              isRequired: false,
              minSelect: 0,
              maxSelect: 2,
              sortOrder: 0,
              options: [
                { id: 'opt-spicy', name: 'Острый', priceDelta: 0, isActive: true, sortOrder: 0 },
                { id: 'opt-garlic', name: 'Чесночный', priceDelta: 0, isActive: true, sortOrder: 1 },
              ],
            },
          ],
        },
        {
          id: 'item-lagman',
          name: 'Лагман',
          description: 'Говядина, лапша, овощи, острый соус',
          price: 42000,
          isActive: true,
          isInStock: true,
          sortOrder: 1,
          modifiers: [
            {
              id: 'mod-spice',
              name: 'Острота',
              isRequired: false,
              minSelect: 0,
              maxSelect: 1,
              sortOrder: 0,
              options: [
                { id: 'opt-spice-low', name: 'Мягкий', priceDelta: 0, isActive: true, sortOrder: 0 },
                { id: 'opt-spice-med', name: 'Средний', priceDelta: 0, isActive: true, sortOrder: 1 },
                { id: 'opt-spice-hot', name: 'Острый', priceDelta: 0, isActive: true, sortOrder: 2 },
              ],
            },
          ],
        },
        {
          id: 'item-besh',
          name: 'Бешбармак',
          description: 'Домашняя лапша, отварное мясо, лук',
          price: 50000,
          isActive: true,
          isInStock: true,
          sortOrder: 2,
          modifiers: [],
        },
        {
          id: 'item-manty',
          name: 'Манты',
          description: 'Баранина, лук, 5 шт',
          price: 38000,
          isActive: true,
          isInStock: true,
          sortOrder: 3,
          modifiers: [
            {
              id: 'mod-sourcream',
              name: 'Сметана',
              isRequired: false,
              minSelect: 0,
              maxSelect: 1,
              sortOrder: 0,
              options: [{ id: 'opt-sourcream', name: 'Добавить сметану', priceDelta: 5000, isActive: true, sortOrder: 0 }],
            },
          ],
        },
        {
          id: 'item-samsa',
          name: 'Самса',
          description: 'Печеная, с говядиной, 1 шт',
          price: 12000,
          isActive: true,
          isInStock: true,
          sortOrder: 4,
          modifiers: [],
        },
      ],
    },
    {
      id: 'cat-drinks',
      name: 'Напитки',
      sortOrder: 1,
      items: [
        {
          id: 'item-tea',
          name: 'Чай',
          description: 'Черный, 500 мл',
          price: 12000,
          isActive: true,
          isInStock: true,
          sortOrder: 0,
          modifiers: [],
        },
        {
          id: 'item-coffee',
          name: 'Кофе американо',
          description: '250 мл',
          price: 15000,
          isActive: true,
          isInStock: true,
          sortOrder: 1,
          modifiers: [],
        },
        {
          id: 'item-latte',
          name: 'Латте',
          description: 'Молочный кофе, 300 мл',
          price: 18000,
          isActive: true,
          isInStock: true,
          sortOrder: 2,
          modifiers: [],
        },
        {
          id: 'item-lemonade',
          name: 'Лимонад',
          description: 'Домашний, 500 мл',
          price: 16000,
          isActive: true,
          isInStock: true,
          sortOrder: 3,
          modifiers: [],
        },
      ],
    },
    {
      id: 'cat-salads',
      name: 'Салаты',
      sortOrder: 2,
      items: [
        {
          id: 'item-greek',
          name: 'Греческий',
          description: 'Огурцы, помидоры, фета, маслины',
          price: 24000,
          isActive: true,
          isInStock: true,
          sortOrder: 0,
          modifiers: [],
        },
        {
          id: 'item-caesar',
          name: 'Цезарь с курицей',
          description: 'Курица, айсберг, соус цезарь, гренки',
          price: 28000,
          isActive: true,
          isInStock: true,
          sortOrder: 1,
          modifiers: [],
        },
        {
          id: 'item-vin',
          name: 'Винегрет',
          description: 'Свекла, картофель, морковь, горошек',
          price: 19000,
          isActive: true,
          isInStock: true,
          sortOrder: 2,
          modifiers: [],
        },
      ],
    },
    {
      id: 'cat-desserts',
      name: 'Десерты',
      sortOrder: 3,
      items: [
        {
          id: 'item-cheesecake',
          name: 'Чизкейк',
          description: 'Сливочный, клубничный соус',
          price: 27000,
          isActive: true,
          isInStock: true,
          sortOrder: 0,
          modifiers: [],
        },
        {
          id: 'item-tiramisu',
          name: 'Тирамису',
          description: 'Кофейный крем, савоярди',
          price: 30000,
          isActive: true,
          isInStock: true,
          sortOrder: 1,
          modifiers: [],
        },
        {
          id: 'item-icecream',
          name: 'Мороженое',
          description: 'Шарики на выбор',
          price: 15000,
          isActive: true,
          isInStock: true,
          sortOrder: 2,
          modifiers: [
            {
              id: 'mod-icecream',
              name: 'Вкус',
              isRequired: false,
              minSelect: 0,
              maxSelect: 2,
              sortOrder: 0,
              options: [
                { id: 'opt-ice-vanilla', name: 'Ваниль', priceDelta: 0, isActive: true, sortOrder: 0 },
                { id: 'opt-ice-choco', name: 'Шоколад', priceDelta: 0, isActive: true, sortOrder: 1 },
                { id: 'opt-ice-berry', name: 'Ягоды', priceDelta: 0, isActive: true, sortOrder: 2 },
              ],
            },
          ],
        },
      ],
    },
  ],
});

type MenuItemWithModifiers = PrismaClientNamespace.MenuItemGetPayload<{
  include: { modifiers: { include: { options: true } } };
}>;

type MenuCategoryWithItems = PrismaClientNamespace.MenuCategoryGetPayload<{
  include: { items: { include: { modifiers: { include: { options: true } } } } };
}>;

const toMenuVersionString = (version?: number | null) => `v${version ?? 1}`;

const ensureMenuRecord = async (venue: { id: string; name: string }) =>
  prisma.menu.upsert({
    where: { venueId: venue.id },
    update: { name: `${venue.name} menu` },
    create: { venueId: venue.id, name: `${venue.name} menu` },
  });

const mapMenuOptionFromDb = (option: DbMenuModifierOption) => ({
  id: option.id,
  name: option.name,
  priceDelta: option.priceDelta ?? 0,
  isActive: option.isActive ?? true,
  sortOrder: option.sortOrder ?? 0,
});

const mapMenuGroupFromDb = (
  group: DbMenuModifierGroup & { options: DbMenuModifierOption[] }
) => ({
  id: group.id,
  name: group.name,
  isRequired: group.isRequired ?? false,
  minSelect: group.minSelect ?? 0,
  maxSelect: group.maxSelect ?? 1,
  sortOrder: group.sortOrder ?? 0,
  options: (group.options ?? []).map(mapMenuOptionFromDb).sort((a, b) => a.sortOrder - b.sortOrder),
});

const mapMenuItemFromDb = (item: MenuItemWithModifiers) => ({
  id: item.id,
  name: item.name,
  description: item.description ?? undefined,
  imageUrl: item.imageUrl ?? undefined,
  accentColor: item.accentColor ?? undefined,
  price: item.price,
  isActive: item.isActive ?? true,
  isInStock: item.isInStock ?? true,
  sortOrder: item.sortOrder ?? 0,
  modifiers: (item.modifiers ?? []).map(mapMenuGroupFromDb).sort((a, b) => a.sortOrder - b.sortOrder),
});

const mapMenuCategoryFromDb = (category: MenuCategoryWithItems) => ({
  id: category.id,
  name: category.name,
  color: category.color ?? undefined,
  sortOrder: category.sortOrder ?? 0,
  items: (category.items ?? []).map(mapMenuItemFromDb).sort((a, b) => a.sortOrder - b.sortOrder),
});

const buildMenuPayload = (venue: { id: string; name: string; slug: string; currency: string; timezone: string }, categories: MenuCategoryWithItems[]) =>
  PublicMenuResponseDto.parse({
    venue: {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      currency: venue.currency,
      timezone: venue.timezone,
    },
    categories: categories.map(mapMenuCategoryFromDb),
  });

const loadMenuForVenue = async (venue: DbVenue, opts?: { includeInactive?: boolean }) => {
  const menuRecord = await ensureMenuRecord(venue);
  const categories = await prisma.menuCategory.findMany({
    where: { menuId: menuRecord.id, ...(opts?.includeInactive ? {} : { isActive: true }) },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { menuId: menuRecord.id, ...(opts?.includeInactive ? {} : { isActive: true }) },
        orderBy: { sortOrder: 'asc' },
        include: {
          modifiers: {
            orderBy: { sortOrder: 'asc' },
            include: { options: { orderBy: { sortOrder: 'asc' }, ...(opts?.includeInactive ? {} : { where: { isActive: true } }) } },
          },
        },
      },
    },
  });

  return {
    menuId: menuRecord.id,
    version: menuRecord.version,
    menu: buildMenuPayload(venue, categories),
  };
};

const loadMenuForSlug = async (venueSlug: string, opts?: { includeInactive?: boolean }) => {
  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) return null;
  const data = await loadMenuForVenue(venue, opts);
  return { ...data, venue };
};

const getMenuVersion = async (venueId: string) => {
  const menu = await prisma.menu.findUnique({ where: { venueId }, select: { version: true } });
  return menu?.version ?? 1;
};

const loadMenuItemForVenue = async (venueId: string, menuItemId: string) =>
  prisma.menuItem.findFirst({
    where: { id: menuItemId, venueId },
    include: { modifiers: { include: { options: true }, orderBy: { sortOrder: 'asc' } } },
  });

const rewriteMenuItemModifiers = async (
  tx: PrismaClientNamespace.TransactionClient,
  menuItemId: string,
  modifiers: MenuModifierGroup[] | undefined
) => {
  await tx.menuModifierOption.deleteMany({ where: { group: { itemId: menuItemId } } });
  await tx.menuModifierGroup.deleteMany({ where: { itemId: menuItemId } });
  if (!modifiers?.length) return;
  for (const group of modifiers) {
    const groupId = group.id || uid();
    await tx.menuModifierGroup.create({
      data: {
        id: groupId,
        itemId: menuItemId,
        name: group.name,
        isRequired: group.isRequired ?? false,
        minSelect: group.minSelect ?? 0,
        maxSelect: group.maxSelect ?? 1,
        sortOrder: group.sortOrder ?? 0,
      },
    });
    if (group.options?.length) {
      await tx.menuModifierOption.createMany({
        data: group.options.map((opt, idx) => ({
          id: opt.id || uid(),
          groupId,
          name: opt.name,
          priceDelta: opt.priceDelta ?? 0,
          isActive: opt.isActive ?? true,
          sortOrder: opt.sortOrder ?? idx,
        })),
      });
    }
  }
};

const recordMenuChange = async (
  tx: PrismaClientNamespace.TransactionClient,
  menuId: string,
  venueId: string,
  type: string,
  payload: unknown
) => {
  const updated = await tx.menu.update({ where: { id: menuId }, data: { version: { increment: 1 } }, select: { version: true } });
  const event = await tx.menuChangeEvent.create({
    data: { menuId, venueId, type, payload: payload as PrismaClientNamespace.InputJsonValue, version: updated.version },
  });
  return { version: updated.version, event };
};

const mapMenuEvent = (evt: DbMenuChangeEvent) =>
  MenuChangeEventDto.parse({
    id: evt.id,
    menuId: evt.menuId,
    venueId: evt.venueId,
    type: evt.type,
    payload: evt.payload ?? undefined,
    version: evt.version,
    createdAt: evt.createdAt.toISOString(),
  });

const listMenuEvents = async (venueId: string, sinceVersion?: number) => {
  const menu = await prisma.menu.findUnique({ where: { venueId } });
  if (!menu) return null;
  const events = await prisma.menuChangeEvent.findMany({
    where: { venueId, ...(Number.isFinite(sinceVersion) ? { version: { gt: Number(sinceVersion) } } : {}) },
    orderBy: { version: 'asc' },
    take: 200,
  });
  return MenuChangeEventsResponseDto.parse({
    events: events.map(mapMenuEvent),
    latestVersion: menu.version,
  });
};

const ensureMenuCategory = async (
  tx: PrismaClientNamespace.TransactionClient,
  menuId: string,
  venueId: string,
  categoryId: string | undefined,
  fallbackName: string
) => {
  if (categoryId) {
    const existing = await tx.menuCategory.findUnique({ where: { id: categoryId } });
    if (existing) return existing;
  }
  const sortOrder = await tx.menuCategory.count({ where: { menuId } });
  return tx.menuCategory.create({
    data: {
      id: categoryId || uid(),
      menuId,
      venueId,
      name: fallbackName || 'Category',
      sortOrder,
      isActive: true,
    },
  });
};

const emitMenuUpdated = async (io: IOServer | null, venueId: string, versionOverride?: number) => {
  if (!io) return;
  const versionNumber = versionOverride ?? (await getMenuVersion(venueId));
  const payload = MenuUpdatedEventDto.parse({ version: toMenuVersionString(versionNumber) });
  io.to(buildKitchenRoom(venueId)).emit('menu.updated', payload);
  io.to(buildWaitersRoom(venueId)).emit('menu.updated', payload);
  const sessions = await prisma.tableSession.findMany({
    where: { venueId, status: TableSessionStatusEnum.enum.OPEN },
    select: { id: true },
  });
  sessions.forEach((s) => io!.to(buildSessionRoom(s.id)).emit('menu.updated', payload));
};

const sessionTokens = new Map<string, Set<string>>();

const nowIso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const buildKitchenRoom = (venueId: string) => `venue:${venueId}:kitchen`;
const buildWaitersRoom = (venueId: string) => `venue:${venueId}:waiters`;
const buildSessionRoom = (sessionId: string) => `tableSession:${sessionId}`;

const QUOTE_TTL_MS = 5 * 60 * 1000;

const issueSessionToken = (sessionId: string) => {
  const token = crypto.randomBytes(32).toString('hex');
  const list = sessionTokens.get(sessionId) ?? new Set<string>();
  list.add(token);
  sessionTokens.set(sessionId, list);
  return token;
};
const registerSessionToken = (sessionId: string, token: string) => {
  const list = sessionTokens.get(sessionId) ?? new Set<string>();
  list.add(token);
  sessionTokens.set(sessionId, list);
};

const isSessionTokenValid = (sessionId: string, token?: string | null) => {
  if (!token) return false;
  return sessionTokens.get(sessionId)?.has(token) ?? false;
};

const revokeSessionTokens = (sessionId: string) => {
  sessionTokens.delete(sessionId);
};

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();
const consumeRateLimit = (key: string, limit = authRateLimitMax, windowMs = authRateLimitWindowMs) => {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
};

type LockoutState = { failures: number; lockUntil: number };
const loginLockouts = new Map<string, LockoutState>();
const registerFailedLogin = (key: string) => {
  const now = Date.now();
  const prev = loginLockouts.get(key) ?? { failures: 0, lockUntil: 0 };
  const failures = prev.failures + 1;
  const lockMs = failures <= 3 ? 0 : Math.min(5 * 60 * 1000, 1000 * 2 ** Math.min(failures - 3, 8));
  const lockUntil = lockMs ? now + lockMs : 0;
  loginLockouts.set(key, { failures, lockUntil });
  return lockUntil ? Math.ceil(lockMs / 1000) : 0;
};
const checkLockout = (key: string) => {
  const state = loginLockouts.get(key);
  if (!state) return 0;
  const now = Date.now();
  if (state.lockUntil && state.lockUntil > now) {
    return Math.ceil((state.lockUntil - now) / 1000);
  }
  if (state.lockUntil && state.lockUntil <= now) {
    loginLockouts.set(key, { failures: Math.max(state.failures - 1, 0), lockUntil: 0 });
  }
  return 0;
};
const clearLockout = (key: string) => loginLockouts.delete(key);

const clientIp = (req: any) =>
  (req.ip as string | undefined) ||
  (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
  (req.socket?.remoteAddress as string | undefined) ||
  'unknown';

const refreshCookieOptionsBase = {
  httpOnly: true,
  sameSite: refreshCookieSameSite,
  secure: refreshCookieSecure,
  path: refreshCookiePath,
  ...(refreshCookieDomain ? { domain: refreshCookieDomain } : {}),
};

const setRefreshCookie = (reply: any, token: string, expires: Date) =>
  reply.setCookie(refreshCookieName, token, {
    ...refreshCookieOptionsBase,
    expires,
    maxAge: refreshTokenTtlDays * 24 * 60 * 60,
  });

const clearRefreshCookie = (reply: any) => reply.clearCookie(refreshCookieName, refreshCookieOptionsBase);

const requireStaffAuth = (
  req: { headers: Record<string, any> },
  reply: { status: (code: number) => { send: (body: any) => void } },
  roles?: StaffTokenPayload['role'][]
) => {
  const staff = verifyStaffJwt(parseBearerToken(req.headers.authorization as string | undefined));
  if (!staff) {
    reply.status(401).send({ message: 'Unauthorized' });
    return null;
  }
  if (roles && !roles.includes(staff.role)) {
    reply.status(403).send({ message: 'Forbidden' });
    return null;
  }
  return staff;
};

const requirePlatformAuth = async (
  req: { headers: Record<string, any> },
  reply: { status: (code: number) => { send: (body: any) => void } },
  roles?: PlatformTokenPayload['role'][]
) => {
  const auth = await getPlatformUserFromRequest(req);
  if (!auth) {
    reply.status(401).send({ message: 'Unauthorized' });
    return null;
  }
  if (roles && !roles.includes(auth.payload.role)) {
    reply.status(403).send({ message: 'Forbidden' });
    return null;
  }
  return auth;
};

const validateModifiers = (
  menuItem: MenuItemWithModifiers | null,
  selections: Array<{ optionId: string; optionName?: string; priceDelta: number }>
) => {
  if (!menuItem || !menuItem.isInStock || !menuItem.isActive) return { error: 'OUT_OF_STOCK' as const };
  const byGroup = new Map<string, string[]>();
  selections.forEach((sel) => {
    const group = menuItem.modifiers.find((g) => g.options.some((o) => o.id === sel.optionId));
    if (!group) return;
    const list = byGroup.get(group.id) ?? [];
    list.push(sel.optionId);
    byGroup.set(group.id, list);
  });

  const sanitized: CartItem['modifiers'] = [];
  for (const group of menuItem.modifiers) {
    const selected = byGroup.get(group.id) ?? [];
    if (group.isRequired && selected.length === 0) return { error: 'MODIFIER_REQUIRED' as const };
    if (selected.length < group.minSelect) return { error: 'MODIFIER_MIN' as const };
    if (selected.length > group.maxSelect) return { error: 'MODIFIER_MAX' as const };

    selected.slice(0, group.maxSelect).forEach((id) => {
      const opt = group.options.find((o) => o.id === id);
      if (!opt || !opt.isActive || opt.priceDelta < 0) return;
      sanitized.push({ optionId: opt.id, optionName: opt.name, priceDelta: opt.priceDelta });
    });
  }
  return { modifiers: sanitized };
};

type ActionError = { status: number; code: string; message: string };

const addCartItemForSession = async (input: {
  sessionId: string;
  token: string;
  menuItemId: string;
  qty: number;
  modifiers?: Array<{ optionId: string; optionName?: string; priceDelta: number }>;
  note?: string;
}) => {
  const session = await prisma.tableSession.findUnique({ where: { id: input.sessionId }, include: { table: true } });
  if (!session) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' } satisfies ActionError;
  if (!isSessionTokenValid(session.id, input.token)) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Invalid session token' } satisfies ActionError;
  }
  if (session.status === TableSessionStatusEnum.enum.CLOSED) {
    throw { status: 400, code: 'SESSION_CLOSED', message: 'Session closed' } satisfies ActionError;
  }
  const menuItem = await loadMenuItemForVenue(session.venueId, input.menuItemId);
  if (!menuItem) throw { status: 404, code: 'OUT_OF_STOCK', message: 'Item not available' } satisfies ActionError;
  const modsResult = validateModifiers(menuItem, input.modifiers ?? []);
  if ('error' in modsResult) {
    throw { status: 400, code: modsResult.error ?? 'MODIFIER_INVALID', message: 'Invalid modifiers' } satisfies ActionError;
  }

  await prisma.$transaction(async (tx) => {
    const cartItem = await tx.cartItem.create({
      data: {
        id: uid(),
        sessionId: session.id,
        menuItemId: input.menuItemId,
        qty: input.qty,
        note: input.note,
        unitPrice: menuItem.price,
        itemName: menuItem.name,
        addedByDeviceHash: undefined,
      },
    });
      if (modsResult.modifiers.length) {
        await tx.cartItemModifier.createMany({
          data: modsResult.modifiers.map((m) => ({
            cartItemId: cartItem.id,
            optionId: m.optionId,
            optionName: m.optionName ?? '',
            priceDelta: m.priceDelta,
          })),
        });
      }
    await (tx.tableSession as any).update({
      where: { id: session.id },
      data: { lastActiveAt: nowIso(), stateVersion: { increment: 1 } },
    });
  });

  const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
  const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
  const totals = calcCartTotals(cart);
  return { cart, totals, session };
};

const handleAssistanceRequest = async (input: {
  sessionId: string;
  token: string;
  message?: string;
  deviceHash?: string;
}) => {
  const session = await prisma.tableSession.findUnique({ where: { id: input.sessionId }, include: { table: true } });
  if (!session) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' } satisfies ActionError;
  if (!isSessionTokenValid(session.id, input.token)) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Invalid session token' } satisfies ActionError;
  }
  if (session.status === TableSessionStatusEnum.enum.CLOSED) {
    throw { status: 400, code: 'SESSION_CLOSED', message: 'Session closed' } satisfies ActionError;
  }
  await (prisma.tableSession as any).update({
    where: { id: session.id },
    data: { lastActiveAt: nowIso(), stateVersion: { increment: 1 } },
  });
  return {
    session,
    payload: {
      sessionId: session.id,
      tableId: session.tableId,
      venueId: session.venueId,
      message: input.message,
      deviceHash: input.deviceHash,
    },
  };
};

const updateCartItemQtyForSession = async (input: {
  sessionId: string;
  token: string;
  cartItemId: string;
  qty: number;
}) => {
  const session = await prisma.tableSession.findUnique({ where: { id: input.sessionId } });
  if (!session) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' } satisfies ActionError;
  if (!isSessionTokenValid(session.id, input.token)) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Invalid session token' } satisfies ActionError;
  }
  if (session.status === TableSessionStatusEnum.enum.CLOSED) {
    throw { status: 400, code: 'SESSION_CLOSED', message: 'Session closed' } satisfies ActionError;
  }
  const item = await prisma.cartItem.findUnique({ where: { id: input.cartItemId } });
  if (item) {
    if (input.qty <= 0) {
      await prisma.cartItemModifier.deleteMany({ where: { cartItemId: item.id } });
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({ where: { id: item.id }, data: { qty: input.qty } });
    }
  }
  await prisma.tableSession.update({
    where: { id: session.id },
    data: { lastActiveAt: nowIso(), stateVersion: { increment: 1 } },
  });
  const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
  const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
  const totals = calcCartTotals(cart);
  return { cart, totals, session };
};

const removeCartItemForSession = async (input: { sessionId: string; token: string; cartItemId: string }) => {
  const session = await prisma.tableSession.findUnique({ where: { id: input.sessionId } });
  if (!session) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' } satisfies ActionError;
  if (!isSessionTokenValid(session.id, input.token)) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Invalid session token' } satisfies ActionError;
  }
  if (session.status === TableSessionStatusEnum.enum.CLOSED) {
    throw { status: 400, code: 'SESSION_CLOSED', message: 'Session closed' } satisfies ActionError;
  }
  await prisma.cartItemModifier.deleteMany({ where: { cartItemId: input.cartItemId } });
  await prisma.cartItem.deleteMany({ where: { id: input.cartItemId, sessionId: input.sessionId } });
  await (prisma.tableSession as any).update({
    where: { id: session.id },
    data: { lastActiveAt: nowIso(), stateVersion: { increment: 1 } },
  });
  const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
  const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
  const totals = calcCartTotals(cart);
  return { cart, totals, session };
};

const removeOrderItemForSession = async (input: { sessionId: string; token: string; orderItemId: string }) => {
  const session = await prisma.tableSession.findUnique({ where: { id: input.sessionId } });
  if (!session) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' } satisfies ActionError;
  if (!isSessionTokenValid(session.id, input.token)) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Invalid session token' } satisfies ActionError;
  }
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: input.orderItemId },
    include: { order: true, allocations: true },
  });
  if (!orderItem || !orderItem.order || orderItem.order.sessionId !== input.sessionId) {
    throw { status: 404, code: 'ORDER_ITEM_NOT_FOUND', message: 'Order item not found' } satisfies ActionError;
  }
  if (orderItem.allocations.length > 0) {
    throw { status: 409, code: 'PAID_ITEM', message: 'Cannot remove an item that has been paid' } satisfies ActionError;
  }
  throw { status: 409, code: 'ORDER_LOCKED', message: 'Order already submitted; request staff assistance' } satisfies ActionError;
};

const submitOrderForSession = async (input: {
  sessionId: string;
  token: string;
  clientOrderKey: string;
  comment?: string;
  io?: IOServer | null;
}) => {
  const session = await prisma.tableSession.findUnique({ where: { id: input.sessionId }, include: { table: true } });
  if (!session) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' } satisfies ActionError;
  if (!isSessionTokenValid(session.id, input.token)) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Invalid session token' } satisfies ActionError;
  }
  if (session.status === TableSessionStatusEnum.enum.CLOSED) {
    throw { status: 400, code: 'SESSION_CLOSED', message: 'Session closed' } satisfies ActionError;
  }

  const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
  if (!cartRows.length) throw { status: 400, code: 'CART_EMPTY', message: 'Cart is empty' } satisfies ActionError;
  const cart = cartRows.map((c) => mapCartItem(c, c.modifiers)).sort((a, b) => a.id.localeCompare(b.id));

  const requestHash = computeRequestHash({
    sessionId: session.id,
    comment: input.comment ?? null,
    cart: cart.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      qty: item.qty,
      note: item.note ?? null,
      modifiers: item.modifiers.map((m) => ({ optionId: m.optionId, priceDelta: m.priceDelta })),
    })),
  });

  const result = await withIdempotency(
    prisma as any,
    {
      scope: 'order.create',
      key: input.clientOrderKey,
      requestHash,
      metadata: { sessionId: session.id, tableId: session.tableId, venueId: session.venueId },
    },
    async () => {
      const now = nowIso();
      const numberAgg = await prisma.order.aggregate({
        where: { venueId: session.venueId },
        _max: { number: true },
      });
      const nextNumber = (numberAgg._max.number ?? 0) + 1;

      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: uid(),
            venueId: session.venueId,
            sessionId: session.id,
            tableId: session.tableId,
            status: OrderStatusEnum.enum.NEW,
            number: nextNumber,
            comment: input.comment,
            createdAt: now,
            updatedAt: now,
          },
        });

        for (const item of cart) {
          const orderItem = await tx.orderItem.create({
            data: {
              id: uid(),
              orderId: created.id,
              menuItemId: item.menuItemId,
              qty: item.qty,
              note: item.note,
              unitPrice: item.unitPrice,
              itemName: item.itemName,
            },
          });
          if (item.modifiers.length) {
            await tx.orderItemModifier.createMany({
              data: item.modifiers.map((m) => ({
                id: uid(),
                orderItemId: orderItem.id,
                optionId: m.optionId,
                optionName: m.optionName ?? '',
                priceDelta: m.priceDelta,
              })),
            });
          }
        }

        await tx.cartItemModifier.deleteMany({ where: { cartItem: { sessionId: session.id } } });
        await tx.cartItem.deleteMany({ where: { sessionId: session.id } });
        await (tx.tableSession as any).update({
          where: { id: session.id },
          data: { lastActiveAt: nowIso(), stateVersion: { increment: 1 } },
        });

        const fullOrder = await tx.order.findUnique({
          where: { id: created.id },
          include: { items: { include: { modifiers: true } } },
        });
        return fullOrder!;
      });

      const mappedOrder = mapOrder(order, order.items);
      return { statusCode: 200, body: { order: mappedOrder } };
    }
  );

  const mappedOrder = result.body.order;
  const cartPayload = CartUpdatedEventDto.parse({ cart: [], totals: calcCartTotals([]) });
  const orderPayload = OrderEventDto.parse({ order: mappedOrder });
  if (input.io) {
    input.io.to(buildSessionRoom(session.id)).emit('cart.updated', cartPayload);
    input.io.to(buildSessionRoom(session.id)).emit('order.created', orderPayload);
    if (!result.replay) {
      input.io.to(buildKitchenRoom(session.venueId)).emit('order.created', orderPayload);
    }
    emitTableStateChanged(input.io, session.id, 'order');
  }

  return { order: mappedOrder, replay: result.replay ?? false };
};

const normalizeColor = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};
const isColorValid = (value?: string | null) => {
  const normalized = normalizeColor(value);
  if (!normalized) return true;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
};

const cloneMenuForVenue = (venue: { id: string; name: string; slug: string; currency: string; timezone: string }) => {
  const categories = (demoMenu.categories ?? []).map((cat, catIdx) => ({
    id: uid(),
    name: cat.name ?? `Category ${catIdx + 1}`,
    color: cat.color ?? undefined,
    sortOrder: cat.sortOrder ?? catIdx,
    items: (cat.items ?? []).map((item, itemIdx) => ({
      id: uid(),
      name: item.name ?? `Item ${itemIdx + 1}`,
      description: item.description ?? undefined,
      imageUrl: item.imageUrl ?? undefined,
      accentColor: item.accentColor ?? undefined,
      price: item.price ?? 0,
      isActive: item.isActive ?? true,
      isInStock: item.isInStock ?? true,
      sortOrder: item.sortOrder ?? itemIdx,
      modifiers: (item.modifiers ?? []).map((group, groupIdx) => {
        const groupId = uid();
        return {
          id: groupId,
          name: group.name ?? `Option ${groupIdx + 1}`,
          isRequired: group.isRequired ?? false,
          minSelect: group.minSelect ?? 0,
          maxSelect: group.maxSelect ?? 1,
          sortOrder: group.sortOrder ?? groupIdx,
          options: (group.options ?? []).map((opt, optIdx) => ({
            ...opt,
            id: uid(),
            name: opt.name ?? `Choice ${optIdx + 1}`,
            priceDelta: opt.priceDelta ?? 0,
            isActive: opt.isActive ?? true,
            sortOrder: opt.sortOrder ?? optIdx,
          })),
        };
      }),
    })),
  }));
  return { venue: { id: venue.id, name: venue.name, slug: venue.slug, currency: venue.currency, timezone: venue.timezone }, categories };
};

const ensureDemoVenue = async () => {
  let venue = await prisma.venue.findUnique({ where: { slug: demoVenue.slug } });
  if (!venue) {
    venue = await prisma.venue.create({ data: demoVenue });
  }
  return venue;
};

const ensureDemoMenuData = async (venue: { id: string; name: string }) => {
  const menu = demoMenu;
  if (!menu) return;

  const menuRecord = await prisma.menu.upsert({
    where: { venueId: venue.id },
    update: { name: `${venue.name} menu` },
    create: { venueId: venue.id, name: `${venue.name} menu` },
  });

  for (const category of menu.categories) {
    await prisma.menuCategory.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        sortOrder: category.sortOrder ?? 0,
        isActive: (category as any).isActive ?? true,
        color: category.color ?? null,
        venueId: venue.id,
        menuId: menuRecord.id,
      },
      create: {
        id: category.id,
        venueId: venue.id,
        menuId: menuRecord.id,
        name: category.name,
        sortOrder: category.sortOrder ?? 0,
        isActive: (category as any).isActive ?? true,
        color: category.color ?? null,
      },
    });

    for (const item of category.items) {
      await prisma.menuItem.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          description: item.description ?? null,
          imageUrl: item.imageUrl ?? null,
          accentColor: item.accentColor ?? null,
          price: item.price,
          isActive: item.isActive ?? true,
          isInStock: item.isInStock ?? true,
          sortOrder: item.sortOrder ?? 0,
          categoryId: category.id,
          venueId: venue.id,
          menuId: menuRecord.id,
        },
        create: {
          id: item.id,
          venueId: venue.id,
          menuId: menuRecord.id,
          categoryId: category.id,
          name: item.name,
          description: item.description ?? null,
          imageUrl: item.imageUrl ?? null,
          accentColor: item.accentColor ?? null,
          price: item.price,
          isActive: item.isActive ?? true,
          isInStock: item.isInStock ?? true,
          sortOrder: item.sortOrder ?? 0,
        },
      });

      for (const group of item.modifiers ?? []) {
        await prisma.menuModifierGroup.upsert({
          where: { id: group.id },
          update: {
            name: group.name,
            isRequired: group.isRequired ?? false,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder: group.sortOrder ?? 0,
            itemId: item.id,
          },
          create: {
            id: group.id,
            itemId: item.id,
            name: group.name,
            isRequired: group.isRequired ?? false,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder: group.sortOrder ?? 0,
          },
        });

        for (const option of group.options ?? []) {
          await prisma.menuModifierOption.upsert({
            where: { id: option.id },
            update: {
              name: option.name,
              priceDelta: option.priceDelta ?? 0,
              isActive: option.isActive ?? true,
              sortOrder: option.sortOrder ?? 0,
              groupId: group.id,
            },
            create: {
              id: option.id,
              groupId: group.id,
              name: option.name,
              priceDelta: option.priceDelta ?? 0,
              isActive: option.isActive ?? true,
              sortOrder: option.sortOrder ?? 0,
            },
          });
        }
      }
    }
  }
};

const ensureDemoStaffUsers = async (venueId: string) => {
  const roles: StaffTokenPayload['role'][] = [
    UserRoleEnum.enum.ADMIN,
    UserRoleEnum.enum.WAITER,
    UserRoleEnum.enum.KITCHEN,
  ];
  const passwordHash = await hashPassword(DEMO_STAFF_PASSWORD);
  await Promise.all(
    roles.map((role) =>
      prisma.staffUser.upsert({
        where: { email: `${role.toLowerCase()}@example.com` },
        update: { venueId, role, name: `${role.toLowerCase()} demo`, passwordHash, isActive: true },
        create: {
          id: `staff-${role.toLowerCase()}`,
          venueId,
          role,
          name: `${role.toLowerCase()} demo`,
          email: `${role.toLowerCase()}@example.com`,
          passwordHash,
          isActive: true,
        },
      })
    )
  );
};

const ensureTable = async (venueId: string, tableCode: string) => {
  let table = await prisma.table.findFirst({ where: { venueId, code: tableCode } });
  if (!table) {
    table = await prisma.table.create({
      data: { id: tableCode, venueId, code: tableCode, name: `Table ${tableCode}`, isActive: true },
    });
  }
  return table;
};

const ensureSession = async (payload: { venueSlug: string; tableCode: string; peopleCount?: number }) => {
  const venue = await ensureDemoVenue();
  await ensureDemoStaffUsers(venue.id);
  await ensureDemoMenuData(venue);
  const table = await ensureTable(venue.id, payload.tableCode);

  const existing = await prisma.tableSession.findFirst({
    where: { venueId: venue.id, tableId: table.id, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
  if (existing) {
    return { session: existing, table, venue };
  }

  const session = await prisma.tableSession.create({
    data: {
      venueId: venue.id,
      tableId: table.id,
      status: 'OPEN',
      peopleCount: payload.peopleCount,
      openedAt: nowIso(),
      lastActiveAt: nowIso(),
    },
  });
  return { session, table, venue };
};

const mapCartItem = (item: any, modifiers: any[]): CartItem => ({
  id: item.id,
  sessionId: item.sessionId,
  menuItemId: item.menuItemId,
  qty: item.qty,
  note: item.note ?? undefined,
  unitPrice: item.unitPrice,
  itemName: item.itemName,
  addedByDeviceHash: item.addedByDeviceHash ?? undefined,
  modifiers: modifiers.map((m) => ({ optionId: m.optionId, optionName: m.optionName, priceDelta: m.priceDelta })),
});

const mapOrder = (order: any, items: any[], paidByItem?: Map<string, number>): Order => ({
  id: order.id,
  venueId: order.venueId,
  sessionId: order.sessionId,
  tableId: order.tableId,
  status: order.status as Order['status'],
  number: order.number,
  comment: order.comment ?? undefined,
  acceptedAt: order.acceptedAt?.toISOString(),
  readyAt: order.readyAt?.toISOString(),
  servedAt: order.servedAt?.toISOString(),
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
  items: items.map((i) => {
    const modifiers = i.modifiers.map((m: any) => ({
      id: m.id,
      orderItemId: m.orderItemId,
      optionId: m.optionId,
      optionName: m.optionName,
      priceDelta: m.priceDelta,
    }));
    const total = calcOrderItemTotal({ unitPrice: i.unitPrice, qty: i.qty, modifiers });
    const paidCents = Math.min(paidByItem?.get(i.id) ?? 0, total);
    const remainingCents = Math.max(total - paidCents, 0);
    return {
      id: i.id,
      orderId: i.orderId,
      menuItemId: i.menuItemId,
      qty: i.qty,
      note: i.note ?? undefined,
      unitPrice: i.unitPrice,
      itemName: i.itemName,
      modifiers,
      paidCents,
      remainingCents,
    };
  }),
});

const mapPayment = (payment: any): PaymentIntent =>
  ({
    id: payment.id,
    venueId: payment.venueId,
    sessionId: payment.sessionId,
    orderId: payment.orderId ?? undefined,
    splitPlanId: payment.splitPlanId ?? undefined,
    sharesPaid: payment.sharesPaid ?? undefined,
    amount: payment.amount,
    status: payment.status,
    provider: payment.provider,
    payload: payment.payload as any,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  } as PaymentIntent);

const mapSessionDto = (session: any, table: any): TableSession =>
  ({
    id: session.id,
    venueId: session.venueId,
    tableId: table?.code ?? session.tableId,
    status: session.status,
    peopleCount: session.peopleCount ?? undefined,
    openedAt: session.openedAt.toISOString ? session.openedAt.toISOString() : session.openedAt,
    closedAt: session.closedAt ? (session.closedAt.toISOString ? session.closedAt.toISOString() : session.closedAt) : undefined,
    lastActiveAt: session.lastActiveAt.toISOString ? session.lastActiveAt.toISOString() : session.lastActiveAt,
    stateVersion: session.stateVersion ?? 1,
  } as TableSession);

const mapOwnerVenue = (venue: any) =>
  OwnerVenueDto.parse({
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    address: venue.address ?? undefined,
    currency: venue.currency,
    timezone: venue.timezone,
    isActive: venue.isActive ?? true,
    createdAt: venue.createdAt.toISOString ? venue.createdAt.toISOString() : venue.createdAt,
    updatedAt: venue.updatedAt.toISOString ? venue.updatedAt.toISOString() : venue.updatedAt,
  });

const toIsoString = (value: any) => (value?.toISOString ? value.toISOString() : value);

const mapOwnerTable = (table: any) =>
  OwnerTableDto.parse({
    id: table.id,
    venueId: table.venueId,
    name: table.name,
    code: table.code,
    capacity: table.capacity ?? undefined,
    isActive: table.isActive ?? true,
    createdAt: toIsoString(table.createdAt),
    updatedAt: toIsoString(table.updatedAt),
  });

const TableListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  venueId: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().min(1).optional(),
});

const StaffListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  venueId: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().min(1).optional(),
});

const OrdersListQuery = StaffOrdersQueryDto.extend({
  search: z.string().min(1).optional(),
});

export const buildTableWhere = (
  venueId: string | undefined,
  query: z.infer<typeof TableListQuery>
): PrismaClientNamespace.TableWhereInput => {
  const search = query.search;
  const isActive =
    query.status === 'active' ? true : query.status === 'inactive' ? false : undefined;
  const ci = 'insensitive' as PrismaClientNamespace.QueryMode;
  return {
    ...(venueId ? { venueId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: ci } },
            { code: { contains: search, mode: ci } },
          ],
        }
      : {}),
  };
};

export const buildStaffWhere = (
  venueId: string | undefined,
  query: z.infer<typeof StaffListQuery>
): PrismaClientNamespace.StaffUserWhereInput => {
  const isActive =
    query.status === 'active' ? true : query.status === 'inactive' ? false : undefined;
  const ci = 'insensitive' as PrismaClientNamespace.QueryMode;
  return {
    ...(venueId ? { venueId } : {}),
    ...(query.role ? { role: query.role as any } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: ci } },
            { email: { contains: query.search, mode: ci } },
          ],
        }
      : {}),
  };
};

export const buildOrdersWhere = (
  venueId: string | undefined,
  query: z.infer<typeof OrdersListQuery>
): PrismaClientNamespace.OrderWhereInput => {
  const statusesFilter = query.status
    ? query.status.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  const search = query.search;
  const numericSearch = search && Number.isFinite(Number(search)) ? Number(search) : null;
  const ci = 'insensitive' as PrismaClientNamespace.QueryMode;
  const searchFilters =
    search
      ? [
          { id: search } as PrismaClientNamespace.OrderWhereInput,
          ...(numericSearch ? [{ number: numericSearch }] : []),
          { table: { is: { code: { contains: search, mode: ci } } } } as PrismaClientNamespace.OrderWhereInput,
        ]
      : [];
  return {
    ...(venueId ? { venueId } : {}),
    ...(statusesFilter.length ? { status: { in: statusesFilter as any } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(searchFilters.length ? { OR: searchFilters } : {}),
  };
};

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const calcCartTotals = (cart: CartItem[]) => {
  const subtotal = cart.reduce((sum, item) => {
    const modifiersTotal = item.modifiers.reduce((modSum, mod) => modSum + mod.priceDelta, 0);
    return sum + (item.unitPrice + modifiersTotal) * item.qty;
  }, 0);
  return { subtotal, total: subtotal, itemCount: cart.reduce((sum, item) => sum + item.qty, 0) };
};

const calcOrderItemTotal = (item: { unitPrice: number; qty: number; modifiers: Array<{ priceDelta: number }> }) => {
  const modifiersTotal = item.modifiers.reduce((modSum, mod) => modSum + mod.priceDelta, 0);
  return (item.unitPrice + modifiersTotal) * item.qty;
};

const calcOrderTotal = (order: Order) =>
  order.items.reduce((sum, item) => sum + calcOrderItemTotal(item), 0);

const calcOrdersTotal = (orders: Order[]) => orders.reduce((sum, order) => sum + calcOrderTotal(order), 0);

const calcCartItemsTotal = (cart: CartItem[]) =>
  cart.reduce((sum, item) => {
    const modSum = item.modifiers.reduce((m, mod) => m + mod.priceDelta, 0);
    return sum + (item.unitPrice + modSum) * item.qty;
  }, 0);

const buildTableLink = (venueSlug: string, tableCode: string) => `${FRONTEND_BASE_URL}/v/${venueSlug}/t/${tableCode}`;

export const isOriginAllowed = (origin?: string | undefined) => {
  if (!origin) return true;
  const allowLocal = corsAllowLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  if (allowLocal) return true;
  if (corsAllowedOrigins.includes(origin)) return true;
  try {
    const normalized = new URL(origin).origin;
    if (corsAllowedOrigins.includes(normalized)) return true;
  } catch {
    return false;
  }
  return false;
};

// For tests we need to inject a mock prisma client without booting the server
export const __setTestPrisma = (client: any, prismaNamespace?: any) => {
  prisma = client;
  if (prismaNamespace) Prisma = prismaNamespace;
};

const bumpStateVersion = async (sessionId: string, tx?: any) => {
  const client = tx ?? prisma;
  await (client.tableSession as any).update({
    where: { id: sessionId },
    data: { stateVersion: { increment: 1 }, lastActiveAt: nowIso() },
  });
};

const getSessionState = async (sessionId: string) => {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      cartItems: { include: { modifiers: true }, orderBy: { createdAt: 'asc' } },
      orders: {
        where: { status: { notIn: ['CANCELLED'] } },
        include: {
          items: {
            include: {
              modifiers: true,
              allocations: { where: { payment: { status: PaymentStatusEnum.enum.PAID } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      payments: true,
    },
  });
  if (!session) return null;
  const cart = session.cartItems.map((c) => mapCartItem(c, c.modifiers));
  const allocationList = session.orders.flatMap((order) =>
    order.items.flatMap((itm) => (itm.allocations ?? []).map((alloc) => ({ orderItemId: alloc.orderItemId, amountCents: alloc.amountCents })))
  );
  const allocationMap = buildAllocationMap(allocationList);
  const orders = session.orders.map((o) => mapOrder(o, o.items, allocationMap));
  const payments = session.payments.map((p) => mapPayment(p));
  const outstanding = computeOutstanding(orders, allocationMap);
  const versionNumber = await getMenuVersion(session.venueId);
  return SessionStateDto.parse({
    session: mapSessionDto(session, (session as any).table),
    cart,
    ordersActive: orders,
    payments,
    menuVersion: toMenuVersionString(versionNumber),
    stateVersion: (session as any).stateVersion ?? 1,
    outstanding: {
      base: outstanding.base,
      paid: outstanding.paid,
      remaining: outstanding.remaining,
    },
  });
};

const buildAllocationMap = (allocations: Array<{ orderItemId: string; amountCents: number }>) => {
  const map = new Map<string, number>();
  allocations.forEach((alloc) => {
    map.set(alloc.orderItemId, (map.get(alloc.orderItemId) ?? 0) + Math.max(alloc.amountCents, 0));
  });
  return map;
};

const computeOutstanding = (orders: Order[], allocationsByItem?: Map<string, number>) => {
  const base = calcOrdersTotal(orders);
  const paid =
    allocationsByItem
      ? Array.from(allocationsByItem.values()).reduce((sum, amt) => sum + amt, 0)
      : 0;
  const remaining = Math.max(base - paid, 0);
  return { base, paid, remaining };
};

const loadPaymentContext = async (sessionId: string, client: any = prisma) => {
  const session = await client.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      cartItems: { include: { modifiers: true } },
      orders: {
        where: { status: { notIn: ['CANCELLED'] } },
        include: {
          items: {
            include: {
              modifiers: true,
              allocations: { where: { payment: { status: PaymentStatusEnum.enum.PAID } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        where: { status: PaymentStatusEnum.enum.PAID },
      },
    },
  });
  if (!session) return null;
  const cart = session.cartItems.map((c: any) => mapCartItem(c, c.modifiers));
  const allocationList = session.orders.flatMap((order: any) =>
    order.items.flatMap((itm: any) => (itm.allocations ?? []).map((alloc: any) => ({ orderItemId: alloc.orderItemId, amountCents: alloc.amountCents })))
  );
  const allocationMap = buildAllocationMap(allocationList);
  const orders = session.orders.map((o: any) => mapOrder(o, o.items, allocationMap));
  const payments = session.payments.map((p: any) => mapPayment(p));
  return { session, cart, orders, payments, allocationMap };
};

const buildOrderItemTotals = (orders: Order[]) => {
  const totals = new Map<
    string,
    { total: number; orderId: string; orderNumber: number; label: string }
  >();
  orders.forEach((order) => {
    order.items.forEach((itm) => {
      const modSum = itm.modifiers.reduce((m, mod) => m + mod.priceDelta, 0);
      const amount = (itm.unitPrice + modSum) * itm.qty;
      totals.set(itm.id, {
        total: amount,
        orderId: order.id,
        orderNumber: order.number,
        label: `${itm.itemName} ×${itm.qty}`,
      });
    });
  });
  return totals;
};

const buildRemainingByItem = (orders: Order[]) => {
  const map = new Map<string, number>();
  orders.forEach((order) => {
    order.items.forEach((itm) => {
      const remaining = (itm as any).remainingCents ?? calcOrderItemTotal(itm as any);
      map.set(itm.id, Math.max(remaining, 0));
    });
  });
  return map;
};

const allocatePaymentToItems = (orders: Order[], remainingByItem: Map<string, number>, amount: number) => {
  const sequence: string[] = [];
  orders.forEach((order) => order.items.forEach((itm) => sequence.push(itm.id)));
  const allocations: Array<{ orderItemId: string; amountCents: number }> = [];
  let remainingAmount = amount;
  for (const id of sequence) {
    if (remainingAmount <= 0) break;
    const remainingForItem = Math.max(remainingByItem.get(id) ?? 0, 0);
    if (remainingForItem <= 0) continue;
    const toAllocate = Math.min(remainingForItem, remainingAmount);
    if (toAllocate > 0) {
      allocations.push({ orderItemId: id, amountCents: toAllocate });
      remainingAmount -= toAllocate;
    }
  }
  if (remainingAmount > 0) {
    throw { status: 409, code: 'STALE_STATE', message: 'Unable to allocate payment to items' };
  }
  return allocations;
};

const computeEvenShareAmount = (remainingCents: number, remainingShares: number, sharesToPay: number) => {
  if (remainingCents <= 0 || remainingShares <= 0) {
    return { amount: 0, shareCosts: [] as number[], baseShare: 0, remainder: 0 };
  }
  const baseShare = Math.floor(remainingCents / remainingShares);
  const remainder = remainingCents % remainingShares;
  const sharePriceList = Array.from({ length: remainingShares }, (_, idx) => (idx < remainder ? baseShare + 1 : baseShare));
  const shareCosts = sharePriceList.slice(0, sharesToPay);
  const amount = shareCosts.reduce((sum, v) => sum + v, 0);
  return { amount, shareCosts, baseShare, remainder };
};

const createOrUpdateSplitPlan = async (sessionId: string, totalShares: number) => {
  if (totalShares < 2 || totalShares > 50) {
    throw { status: 400, code: 'INVALID_SPLIT', message: 'Split must be between 2 and 50' };
  }
  const client: any = prisma as any;
  const session = await client.tableSession.findUnique({ where: { id: sessionId } });
  if (!session) throw { status: 404, message: 'Session not found' };
  const stateVersion = (session as any).stateVersion ?? 1;
  const plan = await client.$transaction(async (tx: any) => {
    const existing = await tx.splitPlan.findFirst({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
    if (!existing) {
      return tx.splitPlan.create({
        data: { id: uid(), sessionId, totalShares, baseVersion: stateVersion, locked: false },
      });
    }
    const paidSharesAgg = await tx.paymentIntent.aggregate({
      where: { splitPlanId: existing.id, status: PaymentStatusEnum.enum.PAID },
      _sum: { sharesPaid: true },
    });
    const paidShares = paidSharesAgg._sum.sharesPaid ?? 0;
    if (existing.locked || paidShares > 0) {
      if (existing.totalShares !== totalShares) {
        throw { status: 400, code: 'SPLIT_PLAN_LOCKED', message: 'Split plan already in use' };
      }
      if (!existing.locked && paidShares > 0) {
        await tx.splitPlan.update({ where: { id: existing.id }, data: { locked: true } });
      }
      return existing;
    }
    return tx.splitPlan.update({
      where: { id: existing.id },
      data: { totalShares, baseVersion: stateVersion, locked: false, updatedAt: new Date() },
    });
  });
  const paidSharesAgg = await client.paymentIntent.aggregate({
    where: { splitPlanId: plan.id, status: PaymentStatusEnum.enum.PAID },
    _sum: { sharesPaid: true },
  });
  const paidShares = paidSharesAgg._sum.sharesPaid ?? 0;
  const remainingShares = Math.max(plan.totalShares - paidShares, 0);
  await bumpStateVersion(sessionId, client);
  return { plan, paidShares, remainingShares, stateVersion: stateVersion + 1 };
};

const createPaymentQuote = async (
  sessionId: string,
  payload: {
    mode: 'FULL' | 'EVEN' | 'SELECTED';
    stateVersion: number;
    splitPlanId?: string;
    sharesToPay?: number;
    selectedOrderItemIds?: string[];
    tipCents?: number;
    tipPercent?: number;
  }
) => {
  const client: any = prisma as any;
  const ctx = await loadPaymentContext(sessionId);
  if (!ctx) throw { status: 404, message: 'Session not found' };

  const serverStateVersion = (ctx.session as any).stateVersion ?? 1;
  if (payload.stateVersion !== serverStateVersion) {
    throw { status: 409, code: 'STALE_STATE', serverStateVersion, state: await getSessionState(sessionId) };
  }

  const { orders, allocationMap } = ctx;
  const outstandingFull = computeOutstanding(orders, allocationMap);
  const remaining = outstandingFull.remaining;
  if (remaining <= 0) throw { status: 400, code: 'NOTHING_TO_PAY', message: 'Nothing to pay' };

  const tipPercent = payload.tipPercent;
  let tipCents = payload.tipCents;
  let baseAmount = remaining;
  let splitPlanId: string | undefined;
  let sharesToPay: number | undefined;
  let selectedOrderItemIds: string[] | undefined;
  let breakdown: Record<string, any> = { baseAmount: remaining };

  if (payload.mode === 'FULL') {
    baseAmount = remaining;
    breakdown = { mode: 'FULL', baseAmount };
  } else if (payload.mode === 'EVEN') {
    splitPlanId = payload.splitPlanId;
    if (!splitPlanId) {
      const latestPlan = await client.splitPlan.findFirst({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
      if (latestPlan) splitPlanId = latestPlan.id;
    }
    if (!splitPlanId) {
      throw { status: 400, code: 'SPLIT_PLAN_REQUIRED', message: 'Create split plan first' };
    }
    const plan = await client.splitPlan.findUnique({ where: { id: splitPlanId } });
    if (!plan || plan.sessionId !== sessionId) {
      throw { status: 404, code: 'SPLIT_PLAN_NOT_FOUND', message: 'Split plan not found' };
    }
    const paidSharesAgg = await client.paymentIntent.aggregate({
      where: { splitPlanId: plan.id, status: PaymentStatusEnum.enum.PAID },
      _sum: { sharesPaid: true },
    });
    const paidShares = paidSharesAgg._sum.sharesPaid ?? 0;
    const remainingShares = Math.max(plan.totalShares - paidShares, 0);
    if (remainingShares <= 0) {
      throw { status: 400, code: 'NOTHING_TO_PAY', message: 'All shares paid' };
    }
    sharesToPay = Math.max(payload.sharesToPay ?? 1, 1);
    if (sharesToPay > remainingShares) {
      sharesToPay = remainingShares;
    }
    const { amount, shareCosts, baseShare, remainder } = computeEvenShareAmount(remaining, remainingShares, sharesToPay);
    if (amount <= 0) throw { status: 400, code: 'NOTHING_TO_PAY', message: 'Nothing to pay' };
    baseAmount = amount;
    breakdown = { mode: 'EVEN', baseAmount, sharesToPay, shareCosts, totalShares: plan.totalShares, paidShares, remainingShares, baseShare, remainder };
  } else if (payload.mode === 'SELECTED') {
    selectedOrderItemIds = payload.selectedOrderItemIds ?? [];
    if (!selectedOrderItemIds.length) {
      throw { status: 400, code: 'INVALID_ITEMS', message: 'No items selected' };
    }
    baseAmount = 0;
    const totals = buildOrderItemTotals(orders);
    const paidByItem = allocationMap ?? new Map<string, number>();
    const remainingByItem = buildRemainingByItem(orders);
    const conflicts: string[] = [];
    const itemsBreakdown: Array<{ orderItemId: string; amount: number; label: string }> = [];
    selectedOrderItemIds.forEach((id) => {
      const total = totals.get(id);
      if (!total) {
        conflicts.push(id);
        return;
      }
      const paidForItem = paidByItem.get(id) ?? 0;
      const remainingForItem = Math.max(remainingByItem.get(id) ?? total.total - paidForItem, 0);
      if (remainingForItem <= 0) {
        conflicts.push(id);
        return;
      }
      itemsBreakdown.push({ orderItemId: id, amount: remainingForItem, label: total.label });
    });
    baseAmount = itemsBreakdown.reduce((sum, itm) => sum + itm.amount, 0);
    if (conflicts.length) {
      throw { status: 409, code: 'ITEMS_ALREADY_PAID', conflicts };
    }
    if (baseAmount <= 0) {
      throw { status: 400, code: 'NOTHING_TO_PAY', message: 'Nothing to pay for selected items' };
    }
    breakdown = { mode: 'SELECTED', baseAmount, items: itemsBreakdown };
  } else {
    throw { status: 400, code: 'INVALID_MODE', message: 'Invalid payment mode' };
  }

  tipCents =
    tipCents ??
    (tipPercent !== undefined ? Math.max(Math.round((baseAmount * tipPercent) / 100), 0) : 0);
  breakdown = { ...breakdown, tipCents, tipPercent };

  const amount = baseAmount + tipCents;
  if (amount <= 0 || amount > remaining + tipCents) {
    throw { status: 400, code: 'AMOUNT_EXCEEDS', message: 'Invalid amount' };
  }

  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
  const storedBreakdown = { ...breakdown, selectedOrderItemIds };
  const saved = await client.paymentQuote.create({
    data: {
      id: uid(),
      sessionId,
      mode: payload.mode,
      amount,
      stateVersion: serverStateVersion,
      splitPlanId: splitPlanId ?? null,
      sharesToPay: sharesToPay ?? null,
      selectedItems: storedBreakdown,
      expiresAt,
    },
  });
  const currency = (ctx.session as any).venue?.currency ?? 'KGS';
  return {
    quote: saved,
    currency,
    baseAmount,
    breakdown,
    remainingBefore: remaining,
    selectedOrderItemIds,
    tipCents,
  };
};

const createPaymentForQuote = async (
  sessionId: string,
  quoteId: string,
  opts: { tipPercent?: number; tipAmount?: number; paidByDeviceHash?: string; io?: IOServer | null }
) => {
  const client: any = prisma as any;
  const quoteRow = await client.paymentQuote.findUnique({ where: { id: quoteId } });
  if (!quoteRow || quoteRow.sessionId !== sessionId) {
    throw { status: 409, message: 'Quote expired or invalid' };
  }
  if (quoteRow.expiresAt.getTime() < Date.now()) {
    throw { status: 409, message: 'Quote expired or invalid' };
  }
  const stored = (quoteRow as any).selectedItems ?? {};
  const storedTip = typeof stored.tipCents === 'number' ? stored.tipCents : 0;
  if (opts.tipAmount !== undefined && opts.tipAmount !== storedTip) {
    throw { status: 400, code: 'TIP_MISMATCH', message: 'Tip does not match quote' };
  }
  const payment = await client.$transaction(async (tx: any) => {
    const context = await loadPaymentContext(sessionId, tx);
    if (!context) throw { status: 404, message: 'Session not found' };
    const { orders, allocationMap, session } = context;
    const serverStateVersion = (session as any).stateVersion ?? 1;
    const outstandingFull = computeOutstanding(orders, allocationMap);
    if (outstandingFull.remaining <= 0) throw { status: 400, message: 'Nothing to pay' };

    const staleError = async () => ({
      status: 409,
      code: 'STALE_STATE',
      serverStateVersion,
      state: await getSessionState(sessionId),
    });

    if (quoteRow.stateVersion !== serverStateVersion) {
      throw await staleError();
    }

    const tipCents = storedTip;
    let baseAmount = typeof stored.baseAmount === 'number' ? stored.baseAmount : quoteRow.amount - tipCents;
    let splitPlanId = quoteRow.splitPlanId ?? undefined;
    let sharesToPay = quoteRow.sharesToPay ?? undefined;
    const selectedOrderItemIds: string[] =
      stored.selectedOrderItemIds ??
      (Array.isArray(stored.items) ? stored.items.map((it: any) => it.orderItemId).filter(Boolean) : []);
    const remainingByItem = buildRemainingByItem(orders);
    let allocationsForPayment: Array<{ orderItemId: string; amountCents: number }> = [];

    if (quoteRow.mode === 'FULL') {
      baseAmount = Math.min(baseAmount, outstandingFull.remaining);
      if (baseAmount + tipCents !== quoteRow.amount) throw await staleError();
      allocationsForPayment = allocatePaymentToItems(orders, remainingByItem, baseAmount);
    } else if (quoteRow.mode === 'EVEN') {
      if (!splitPlanId || !sharesToPay) throw await staleError();
      await tx.$queryRaw`SELECT id FROM "SplitPlan" WHERE id = ${splitPlanId} FOR UPDATE`;
      const plan = await tx.splitPlan.findUnique({ where: { id: splitPlanId } });
      if (!plan || plan.sessionId !== sessionId) throw await staleError();
      const paidSharesAgg = await tx.paymentIntent.aggregate({
        where: { splitPlanId, status: PaymentStatusEnum.enum.PAID },
        _sum: { sharesPaid: true },
      });
      const paidShares = paidSharesAgg._sum.sharesPaid ?? 0;
      const remainingShares = Math.max(plan.totalShares - paidShares, 0);
      if (remainingShares < sharesToPay) throw await staleError();
      const { amount } = computeEvenShareAmount(outstandingFull.remaining, remainingShares, sharesToPay);
      if (amount <= 0 || amount + tipCents !== quoteRow.amount) throw await staleError();
      baseAmount = amount;
      allocationsForPayment = allocatePaymentToItems(orders, remainingByItem, baseAmount);
    } else if (quoteRow.mode === 'SELECTED') {
      const totals = buildOrderItemTotals(orders);
      const ids = selectedOrderItemIds ?? [];
      if (!ids.length) throw await staleError();
      const conflicts: string[] = [];
      let recalculated = 0;
      ids.forEach((id) => {
        const total = totals.get(id);
        if (!total) {
          conflicts.push(id);
          return;
        }
        const remainingForItem = Math.max(remainingByItem.get(id) ?? 0, 0);
        if (remainingForItem <= 0) {
          conflicts.push(id);
          return;
        }
        allocationsForPayment.push({ orderItemId: id, amountCents: remainingForItem });
        recalculated += remainingForItem;
      });
      if (conflicts.length) {
        throw { status: 409, code: 'ITEMS_ALREADY_PAID', conflicts, state: await getSessionState(sessionId) };
      }
      if (recalculated + tipCents !== quoteRow.amount) throw await staleError();
      baseAmount = recalculated;
    } else {
      throw await staleError();
    }

    if (opts.tipPercent !== undefined) {
      const expectedTip = Math.max(Math.round((baseAmount * opts.tipPercent) / 100), 0);
      if (expectedTip !== tipCents) {
        throw { status: 400, code: 'TIP_MISMATCH', message: 'Tip does not match quote' };
      }
    }

    const totalAmount = baseAmount + tipCents;
    if (totalAmount !== quoteRow.amount) throw await staleError();

    const now = new Date();
    const paymentCreated = await (tx.paymentIntent as any).create({
      data: {
        id: uid(),
        venueId: session.venueId,
        sessionId,
        splitPlanId: quoteRow.splitPlanId ?? undefined,
        sharesPaid: quoteRow.mode === 'EVEN' ? sharesToPay ?? null : null,
        amount: totalAmount,
        status: PaymentStatusEnum.enum.CREATED,
        provider: 'mock',
        payload: {
          mode: quoteRow.mode,
          splitPlanId,
          sharesToPay,
          selectedOrderItemIds,
          selectedItems: stored.items,
          shareCosts: stored.shareCosts,
          baseAmount,
          tipAmount: tipCents,
          paidByDeviceHash: opts.paidByDeviceHash,
        },
        createdAt: now,
        updatedAt: now,
      } as any,
    });
    if (allocationsForPayment.length) {
      await tx.paymentAllocation.createMany({
        data: allocationsForPayment.map((alloc) => ({
          paymentId: paymentCreated.id,
          orderItemId: alloc.orderItemId,
          amountCents: alloc.amountCents,
          createdAt: now,
        })),
      });
    }
    const settled = await (tx.paymentIntent as any).update({
      where: { id: paymentCreated.id },
      data: { status: PaymentStatusEnum.enum.PAID, updatedAt: new Date() },
    });
    await bumpStateVersion(sessionId, tx);
    await tx.paymentQuote.delete({ where: { id: quoteRow.id } }).catch(() => null);
    return mapPayment(settled);
  });

  if (opts.io) {
    emitPaymentUpdated(opts.io, payment);
    emitTableStateChanged(opts.io, payment.sessionId, 'payment');
  }
  return payment;
};

const emitOrderUpdated = (io: IOServer, order: Order) => {
  const payload = OrderEventDto.parse({ order });
  io.to(buildSessionRoom(order.sessionId)).emit('order.updated', payload);
  io.to(buildKitchenRoom(order.venueId)).emit('order.updated', payload);
  if (order.status === OrderStatusEnum.enum.READY || order.status === OrderStatusEnum.enum.SERVED) {
    io.to(buildWaitersRoom(order.venueId)).emit('order.updated', payload);
  }
};

const emitPaymentUpdated = (io: IOServer, payment: PaymentIntent) => {
  const payload = PaymentUpdatedEventDto.parse({ payment });
  io.to(buildSessionRoom(payment.sessionId)).emit('payment.updated', payload);
};

const emitTableStateChanged = (io: IOServer | null, sessionId: string, reason: string) => {
  if (!io) return;
  io.to(buildSessionRoom(sessionId)).emit('table.stateChanged', {
    sessionId,
    reason,
    at: nowIso(),
  });
};

const getPlatformUserFromRequest = async (req: any) => {
  const token = parseBearerToken(req.headers.authorization as string | undefined);
  const payload = verifyPlatformJwt(token);
  if (!payload || payload.role !== UserRoleEnum.enum.PLATFORM_OWNER) return null;
  const user = await prisma.platformUser.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;
  return { payload, user };
};

const closeSession = async (sessionId: string, reason: string, io: IOServer | null) => {
  const session = await prisma.tableSession.findUnique({ where: { id: sessionId }, include: { table: true } });
  if (!session) return;
  await prisma.tableSession.update({ where: { id: sessionId }, data: { status: TableSessionStatusEnum.enum.CLOSED, closedAt: nowIso() } });
  revokeSessionTokens(sessionId);
  if (io) {
    io.to(buildSessionRoom(sessionId)).emit('session.closed', { sessionId, reason, closedAt: nowIso() });
  }
};

async function main() {
  ({ prisma, Prisma } = await prismaModulePromise);
  staffService = createStaffService(prisma);
  platformService = createPlatformService(prisma);
  await platformService.ensureOwnerUser(platformOwnerEmail, platformOwnerPassword);
  const app = Fastify({ logger: true });
  let io: IOServer | null = null;
  let prismaErrorSilencedUntil = 0;

  app.log.info({ node: process.version, databaseUrl: process.env.DATABASE_URL }, 'runtime env');

  const handlePrismaError = (err: unknown, context: string) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P5010') {
      const now = Date.now();
      if (now > prismaErrorSilencedUntil) {
        app.log.error({ err }, context);
        prismaErrorSilencedUntil = now + 60_000;
      }
      return;
    }
    app.log.error({ err }, context);
  };

  await app.register(cors, {
    origin: ((origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'), false);
    }) as import('@fastify/cors').OriginFunction,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user-role', 'authorization', 'Idempotency-Key', 'idempotency-key'],
  });
  await app.register(fastifyCookie);

  app.get('/health', async () => ({ ok: true }));

  // Public
  app.get('/public/venues/:venueSlug/menu', async (req, reply) => {
    const { venueSlug } = req.params as { venueSlug: string };
    const ensured = await loadMenuForSlug(venueSlug);
    if (!ensured) return reply.status(404).send({ message: 'Venue not found' });
    reply.header('x-menu-version', toMenuVersionString(ensured.version));
    return reply.send(ensured.menu);
  });

  app.post('/public/sessions/join', async (req, reply) => {
    const parsed = JoinSessionDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    try {
      const ensured = await ensureSession(parsed.data);
      const session = ensured.session;
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { lastActiveAt: nowIso(), peopleCount: parsed.data.peopleCount ?? session.peopleCount },
      });
      const token = issueSessionToken(session.id);
      const state = await getSessionState(session.id);
      if (!state) return reply.status(404).send({ message: 'Session not found' });

      return JoinSessionResponseDto.parse({
        sessionId: session.id,
        token,
        ...state,
      });
    } catch (err) {
      handlePrismaError(err, 'join session failed');
      return reply.status(503).send({ message: 'Unable to join session. Is the database running?' });
    }
  });

  app.get('/public/sessions/:sessionId/state', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const token = parseBearerToken(req.headers.authorization as string | undefined);
    if (!isSessionTokenValid(sessionId, token)) {
      return reply.status(401).send({ message: 'Invalid or missing session token' });
    }
    const sessionState = await getSessionState(sessionId);
    if (!sessionState) return reply.status(404).send({ message: 'Session not found' });
    return sessionState;
  });

  app.post('/public/sessions/:sessionId/cart', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = CartAddItemDto.safeParse({ ...body, sessionId });
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const token = parseBearerToken(req.headers.authorization as string | undefined) ?? parsed.data.token;
    if (!token) return reply.status(401).send({ message: 'Missing token' });
    try {
      const result = await addCartItemForSession({
        sessionId,
        token,
        menuItemId: parsed.data.menuItemId,
        qty: parsed.data.qty,
        modifiers: parsed.data.modifiers ?? [],
        note: parsed.data.note,
      });
      emitTableStateChanged(io, sessionId, 'cart');
      return reply.send({ state: await getSessionState(sessionId) });
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply.status(status).send({ message: err?.message ?? 'Add to cart failed', code: err?.code });
    }
  });

  app.post('/public/sessions/:sessionId/assistance', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = AssistanceRequestDto.safeParse({ ...body, sessionId });
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const token = parseBearerToken(req.headers.authorization as string | undefined) ?? parsed.data.token;
    if (!token) return reply.status(401).send({ message: 'Missing token' });
    try {
      const result = await handleAssistanceRequest({
        sessionId,
        token,
        message: parsed.data.message,
        deviceHash: parsed.data.deviceHash,
      });
      io?.to(buildWaitersRoom(result.session.venueId)).emit('table.assistanceRequested', result.payload);
      emitTableStateChanged(io, result.session.id, 'assistance');
      return reply.send({ state: await getSessionState(result.session.id) });
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply.status(status).send({ message: err?.message ?? 'Assistance request failed', code: err?.code });
    }
  });

  app.patch('/public/sessions/:sessionId/cart/items/:cartItemId', async (req, reply) => {
    const { sessionId, cartItemId } = req.params as { sessionId: string; cartItemId: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = CartUpdateItemQtyDto.safeParse({ ...body, sessionId, cartItemId });
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const token = parseBearerToken(req.headers.authorization as string | undefined) ?? parsed.data.token;
    if (!token) return reply.status(401).send({ message: 'Missing token' });
    try {
      await updateCartItemQtyForSession({
        sessionId,
        token,
        cartItemId,
        qty: parsed.data.qty,
      });
      emitTableStateChanged(io, sessionId, 'cart');
      return reply.send({ state: await getSessionState(sessionId) });
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply.status(status).send({ message: err?.message ?? 'Update cart failed', code: err?.code });
    }
  });

  app.delete('/public/sessions/:sessionId/cart/items/:cartItemId', async (req, reply) => {
    const { sessionId, cartItemId } = req.params as { sessionId: string; cartItemId: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = parseBearerToken(req.headers.authorization as string | undefined) ?? (body.token as string | undefined);
    if (!token) return reply.status(401).send({ message: 'Missing token' });
    try {
      await removeCartItemForSession({ sessionId, token, cartItemId });
      emitTableStateChanged(io, sessionId, 'cart');
      return reply.send({ state: await getSessionState(sessionId) });
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply.status(status).send({ message: err?.message ?? 'Remove cart item failed', code: err?.code });
    }
  });

  app.post('/public/sessions/:sessionId/orders', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = OrderSubmitDto.safeParse({ ...body, sessionId });
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const token = parseBearerToken(req.headers.authorization as string | undefined) ?? parsed.data.token;
    if (!token) return reply.status(401).send({ message: 'Missing token' });
    try {
      const result = await submitOrderForSession({
        sessionId,
        token,
        clientOrderKey: parsed.data.clientOrderKey,
        comment: parsed.data.comment,
        io,
      });
      return reply.send({ state: await getSessionState(sessionId), replay: result.replay ?? false });
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply.status(status).send({ message: err?.message ?? 'Submit order failed', code: err?.code });
    }
  });

  app.post('/public/sessions/:sessionId/payments/split-plan', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = z
      .object({ totalShares: z.number().int().min(2).max(50), token: z.string().optional() })
      .safeParse(body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const token = parseBearerToken(req.headers.authorization as string | undefined) ?? parsed.data.token;
    if (!token || !isSessionTokenValid(sessionId, token)) {
      return reply.status(401).send({ message: 'Invalid session token' });
    }
    try {
      const result = await createOrUpdateSplitPlan(sessionId, parsed.data.totalShares);
      return reply.send({
        splitPlanId: result.plan.id,
        totalShares: result.plan.totalShares,
        paidShares: result.paidShares,
        remainingShares: result.remainingShares,
        stateVersion: result.stateVersion,
      });
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply.status(status).send({ message: err?.message ?? 'Failed to update split plan', code: err?.code });
    }
  });

  app.post('/public/sessions/:sessionId/payments/quote', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = PaymentQuoteRequestDto.safeParse(body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const token = parseBearerToken(req.headers.authorization as string | undefined) ?? (body.token as string | undefined);
    if (!token || !isSessionTokenValid(sessionId, token)) {
      return reply.status(401).send({ message: 'Invalid session token' });
    }
    try {
      const reqPayload = parsed.data as any;
      const { quote, currency, breakdown, remainingBefore, selectedOrderItemIds } = await createPaymentQuote(sessionId, reqPayload);
      const resp = PaymentQuoteResponseDto.parse({
        quoteId: quote.id,
        sessionId,
        amount: quote.amount,
        currency,
        mode: quote.mode,
        splitPlanId: quote.splitPlanId ?? undefined,
        sharesToPay: quote.sharesToPay ?? undefined,
        selectedOrderItemIds: selectedOrderItemIds ?? undefined,
        breakdown,
        remainingBefore,
        expiresAt: quote.expiresAt.toISOString(),
        stateVersion: quote.stateVersion ?? reqPayload.stateVersion,
      });
      return reply.send(resp);
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply
        .status(status)
        .send({ message: err?.message ?? 'Failed to create payment quote', code: err?.code, state: err?.state, serverStateVersion: err?.serverStateVersion });
    }
  });

  app.post('/public/sessions/:sessionId/payments', async (req, reply) => {
    const parsed = PaymentCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());

    const { sessionId } = req.params as { sessionId: string };
    if (parsed.data.sessionId !== sessionId) {
      return reply.status(400).send({ message: 'SessionId mismatch' });
    }
    const bearer = parseBearerToken(req.headers.authorization as string | undefined);
    const token = bearer ?? parsed.data.token;
    if (!token || !isSessionTokenValid(sessionId, token)) {
      return reply.status(401).send({ message: 'Invalid session token' });
    }

    const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });

    const idempotencyKey = getIdempotencyKey(req as any);
    const quoteForHash = await (prisma as any).paymentQuote.findUnique({ where: { id: parsed.data.quoteId } });
    const requestHash = computeRequestHash({
      sessionId,
      quoteId: parsed.data.quoteId,
      tipPercent: parsed.data.tipPercent ?? null,
      tipAmount: parsed.data.tipAmount ?? null,
      amount: quoteForHash?.amount ?? null,
    });

    const runAndEmit = async () => {
      const payment = await createPaymentForQuote(sessionId, parsed.data.quoteId, {
        tipPercent: parsed.data.tipPercent,
        tipAmount: parsed.data.tipAmount ?? undefined,
        paidByDeviceHash: parsed.data.paidByDeviceHash,
        io,
      });
      return { statusCode: 200, body: PaymentCreateResponseDto.parse({ payment }) };
    };

    if (idempotencyKey) {
      try {
        const result = await withIdempotency(
          prisma as any,
          {
            scope: 'payment.create',
            key: idempotencyKey,
            requestHash,
            metadata: { sessionId, tableId: session.tableId, venueId: session.venueId },
          },
          runAndEmit
        );
        if (result.replay && io) {
          io.to(buildSessionRoom(session.id)).emit('payment.updated', PaymentUpdatedEventDto.parse({ payment: result.body.payment }));
        }
        return reply.status(result.statusCode).send(result.body);
      } catch (err: any) {
        if (err?.statusCode === 409) {
          return reply.status(409).send({ message: 'Idempotency key collision' });
        }
        const status = err?.status ?? 500;
        return reply.status(status).send({ message: err?.message ?? 'Failed to create payment', code: err?.code, state: err?.state });
      }
    }

    try {
      const result = await runAndEmit();
      return reply.status(result.statusCode).send(result.body);
    } catch (err: any) {
      const status = err?.status ?? 500;
      return reply.status(status).send({ message: err?.message ?? 'Failed to create payment', code: err?.code, state: err?.state });
    }
  });

  app.get('/public/payments/:paymentId', async (req, reply) => {
    const { paymentId } = req.params as { paymentId: string };
    const payment = await prisma.paymentIntent.findUnique({ where: { id: paymentId } });
    if (!payment) return reply.status(404).send({ message: 'Payment not found' });
    const bearer = parseBearerToken(req.headers.authorization as string | undefined);
    if (!isSessionTokenValid(payment.sessionId, bearer)) {
      return reply.status(401).send({ message: 'Invalid session token' });
    }
    return mapPayment(payment);
  });

  // Auth / staff
  app.post('/auth/login', async (req, reply) => {
    const parsed = AuthLoginDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const ipKey = clientIp(req);
    const idKey = parsed.data.email || parsed.data.phone || 'unknown';
    const ipRate = consumeRateLimit(`staff-login:ip:${ipKey}`);
    if (!ipRate.allowed) {
      return reply.header('Retry-After', ipRate.retryAfter).status(429).send({ message: 'Too many attempts, slow down.' });
    }
    const idRate = consumeRateLimit(`staff-login:id:${idKey}`, Math.max(1, Math.floor(authRateLimitMax / 2)), authRateLimitWindowMs);
    if (!idRate.allowed) {
      return reply.header('Retry-After', idRate.retryAfter).status(429).send({ message: 'Too many attempts for this user.' });
    }
    const lockSeconds = checkLockout(`staff:${idKey}`);
    if (lockSeconds) {
      return reply.header('Retry-After', lockSeconds).status(429).send({ message: 'Account temporarily locked. Try again soon.' });
    }
    const user = await prisma.staffUser.findFirst({
      where: {
        OR: [
          parsed.data.email ? { email: parsed.data.email } : undefined,
          parsed.data.phone ? { phone: parsed.data.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });
    if (!user || !user.isActive) {
      registerFailedLogin(`staff:${idKey}`);
      return reply.status(401).send({ message: 'Invalid credentials' });
    }
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      registerFailedLogin(`staff:${idKey}`);
      return reply.status(401).send({ message: 'Invalid credentials' });
    }
    clearLockout(`staff:${idKey}`);

    const { refreshToken, expiresAt } = await staffService.createRefreshSession(user.id);
    setRefreshCookie(reply, refreshToken, expiresAt);

    const accessToken = issueStaffAccessToken(user);
    return AuthLoginResponseDto.parse({
      accessToken,
      user: mapStaffUser(user),
    });
  });

  app.post('/auth/refresh', async (req, reply) => {
    const ipKey = clientIp(req);
    const ipRate = consumeRateLimit(`staff-refresh:ip:${ipKey}`);
    if (!ipRate.allowed) {
      return reply.header('Retry-After', ipRate.retryAfter).status(429).send({ message: 'Too many attempts, slow down.' });
    }
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[refreshCookieName];
    const session = await staffService.findRefreshSession(token);
    if (!session) {
      clearRefreshCookie(reply);
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }
    const user = await prisma.staffUser.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) {
      await staffService.revokeRefreshSession(token);
      clearRefreshCookie(reply);
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }

    await prisma.staffSession.update({ where: { id: session.id }, data: { revokedAt: nowIso() } });
    const { refreshToken, expiresAt } = await staffService.createRefreshSession(user.id);
    setRefreshCookie(reply, refreshToken, expiresAt);

    const accessToken = issueStaffAccessToken(user);
    return AuthRefreshResponseDto.parse({ accessToken, user: mapStaffUser(user) });
  });

  app.post('/auth/logout', async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[refreshCookieName];
    await staffService.revokeRefreshSession(token);
    clearRefreshCookie(reply);
    return { ok: true };
  });

  const requireOwner = async (req: any, reply: any) => {
    return requirePlatformAuth(req, reply, [UserRoleEnum.enum.PLATFORM_OWNER]);
  };

  // Owner auth
  app.post('/owner/login', async (req, reply) => {
    const parsed = PlatformAuthLoginDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const ipKey = clientIp(req);
    const idKey = parsed.data.email.toLowerCase();
    const ipRate = consumeRateLimit(`owner-login:ip:${ipKey}`);
    if (!ipRate.allowed) {
      return reply.header('Retry-After', ipRate.retryAfter).status(429).send({ message: 'Too many attempts, slow down.' });
    }
    const idRate = consumeRateLimit(`owner-login:id:${idKey}`, Math.max(1, Math.floor(authRateLimitMax / 2)), authRateLimitWindowMs);
    if (!idRate.allowed) {
      return reply.header('Retry-After', idRate.retryAfter).status(429).send({ message: 'Too many attempts for this account.' });
    }
    const lockSeconds = checkLockout(`owner:${idKey}`);
    if (lockSeconds) {
      return reply.header('Retry-After', lockSeconds).status(429).send({ message: 'Owner login locked temporarily.' });
    }
    const user = await prisma.platformUser.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.isActive) {
      registerFailedLogin(`owner:${idKey}`);
      return reply.status(401).send({ message: 'Invalid credentials' });
    }
    const ok = await platformService.verifyUserPassword(user, parsed.data.password);
    if (!ok) {
      registerFailedLogin(`owner:${idKey}`);
      return reply.status(401).send({ message: 'Invalid credentials' });
    }
    clearLockout(`owner:${idKey}`);

    const accessToken = issuePlatformAccessToken({ id: user.id, role: user.role, venueId: user.venueId ?? undefined });
    return PlatformAuthLoginResponseDto.parse({ accessToken, user: mapPlatformUser(user) });
  });

  app.get('/staff/orders', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN, UserRoleEnum.enum.KITCHEN, UserRoleEnum.enum.WAITER]);
    if (!staff) return;
    const parsed = OrdersListQuery.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const query = parsed.data;
    let pagination;
    try {
      pagination = parsePageParams(query, 50);
    } catch (err: any) {
      return reply.status(400).send({ message: err?.message ?? 'Invalid pagination params' });
    }
    const where = buildOrdersWhere(staff.venueId, query);
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { items: { include: { modifiers: true } }, table: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.order.count({ where }),
    ]);
    const mapped = (orders as any[]).map((o) => mapOrder(o, o.items));
    return StaffOrdersResponseDto.parse({ orders: mapped, pageInfo: buildPageInfo(pagination.page, pagination.pageSize, total) });
  });

  app.patch('/staff/orders/:orderId/status', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN, UserRoleEnum.enum.KITCHEN, UserRoleEnum.enum.WAITER]);
    if (!staff) return;
    const { orderId } = req.params as { orderId: string };
    const parsed = StaffOrderStatusPatchDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { modifiers: true } } } });
    if (!order) return reply.status(404).send({ message: 'Order not found' });
    if (order.venueId !== staff.venueId) return reply.status(403).send({ message: 'Forbidden' });

    if (!isOrderTransitionAllowed(staff.role, order.status as any, parsed.data.status)) {
      return reply.status(403).send({ message: 'Transition not allowed for role' });
    }

    const now = nowIso();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: parsed.data.status,
        acceptedAt: parsed.data.status === OrderStatusEnum.enum.ACCEPTED ? now : order.acceptedAt,
        readyAt: parsed.data.status === OrderStatusEnum.enum.READY ? now : order.readyAt,
        servedAt: parsed.data.status === OrderStatusEnum.enum.SERVED ? now : order.servedAt,
        updatedAt: now,
      },
      include: { items: { include: { modifiers: true } } },
    });

    if (io) {
      emitOrderUpdated(io, mapOrder(updated, updated.items));
      emitTableStateChanged(io, updated.sessionId, 'order');
    }

    return OrderEventDto.parse({ order: mapOrder(updated, updated.items) });
  });

  // Admin: menu management (DB-backed)
  app.get('/admin/menu', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const venue = await prisma.venue.findUnique({ where: { id: staff.venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const data = await loadMenuForVenue(venue, { includeInactive: true });
    return { ...data.menu, version: toMenuVersionString(data.version) };
  });

  app.post('/admin/menu', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const parsed = AdminMenuItemCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const accentColor = normalizeColor(parsed.data.accentColor);
    if (!isColorValid(accentColor)) {
      return reply.status(400).send({ message: 'Invalid accentColor format. Use hex like #RRGGBB.' });
    }
    const venue = await prisma.venue.findUnique({ where: { id: staff.venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);

    const result = await prisma.$transaction(async (tx) => {
      const category = await ensureMenuCategory(tx, menuRecord.id, venue.id, parsed.data.categoryId, parsed.data.name);
      const sortOrder = parsed.data.sortOrder ?? (await tx.menuItem.count({ where: { categoryId: category.id } }));
      const created = await tx.menuItem.create({
        data: {
          id: uid(),
          menuId: menuRecord.id,
          venueId: venue.id,
          categoryId: category.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          imageUrl: parsed.data.imageUrl ?? null,
          accentColor,
          price: parsed.data.price,
          isActive: parsed.data.isActive ?? true,
          isInStock: parsed.data.isInStock ?? true,
          sortOrder,
        },
      });
      if (parsed.data.modifiers?.length) {
        await rewriteMenuItemModifiers(tx, created.id, parsed.data.modifiers);
      }
      const fullItem = await tx.menuItem.findUnique({
        where: { id: created.id },
        include: { modifiers: { include: { options: true }, orderBy: { sortOrder: 'asc' } } },
      });
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'ITEM_CREATED', { itemId: created.id });
      return { item: fullItem!, version: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.version);
    return { ok: true, item: mapMenuItemFromDb(result.item as MenuItemWithModifiers) };
  });

  app.patch('/admin/menu/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const { id } = req.params as { id: string };
    const parsed = AdminMenuItemUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const accentColor = parsed.data.accentColor !== undefined ? normalizeColor(parsed.data.accentColor) : undefined;
    if (parsed.data.accentColor !== undefined && !isColorValid(accentColor)) {
      return reply.status(400).send({ message: 'Invalid accentColor format. Use hex like #RRGGBB.' });
    }
    const existing = await prisma.menuItem.findUnique({ where: { id }, include: { modifiers: { include: { options: true } } } });
    if (!existing || existing.venueId !== staff.venueId) return reply.status(404).send({ message: 'Menu item not found' });
    const venue = await prisma.venue.findUnique({ where: { id: staff.venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);

    const result = await prisma.$transaction(async (tx) => {
      let categoryId = existing.categoryId;
      if (parsed.data.categoryId && parsed.data.categoryId !== existing.categoryId) {
        const category = await ensureMenuCategory(tx, menuRecord.id, venue.id, parsed.data.categoryId, parsed.data.name ?? existing.name);
        categoryId = category.id;
      }
      const updateData: PrismaClientNamespace.MenuItemUncheckedUpdateInput = {};
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? null;
      if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl ?? null;
      if (parsed.data.accentColor !== undefined) updateData.accentColor = accentColor ?? null;
      if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
      if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
      if (parsed.data.isInStock !== undefined) updateData.isInStock = parsed.data.isInStock;
      if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
      if (categoryId !== existing.categoryId) updateData.categoryId = categoryId;
      const updatedItem = await tx.menuItem.update({ where: { id }, data: updateData });
      if (parsed.data.modifiers) {
        await rewriteMenuItemModifiers(tx, updatedItem.id, parsed.data.modifiers);
      }
      const fullItem = await tx.menuItem.findUnique({
        where: { id },
        include: { modifiers: { include: { options: true }, orderBy: { sortOrder: 'asc' } } },
      });
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'ITEM_UPDATED', { itemId: id });
      return { item: fullItem!, version: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.version);
    return { ok: true, item: mapMenuItemFromDb(result.item as MenuItemWithModifiers) };
  });

  app.delete('/admin/menu/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const { id } = req.params as { id: string };
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing || existing.venueId !== staff.venueId) return reply.status(404).send({ message: 'Menu item not found' });
    const venue = await prisma.venue.findUnique({ where: { id: staff.venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);

    const result = await prisma.$transaction(async (tx) => {
      await tx.menuModifierOption.deleteMany({ where: { group: { itemId: id } } });
      await tx.menuModifierGroup.deleteMany({ where: { itemId: id } });
      await tx.menuItem.delete({ where: { id } });
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'ITEM_DELETED', { itemId: id });
      return { version: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.version);
    return { ok: true };
  });

  app.post('/admin/menu/seed', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const venue = await prisma.venue.findUnique({ where: { id: staff.venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);
    const menu = cloneMenuForVenue(venue);

    const result = await prisma.$transaction(async (tx) => {
      await tx.menuModifierOption.deleteMany({ where: { group: { item: { menuId: menuRecord.id } } } });
      await tx.menuModifierGroup.deleteMany({ where: { item: { menuId: menuRecord.id } } });
      await tx.menuItem.deleteMany({ where: { menuId: menuRecord.id } });
      await tx.menuCategory.deleteMany({ where: { menuId: menuRecord.id } });
      for (const category of menu.categories) {
        await tx.menuCategory.create({
          data: {
            id: category.id,
            menuId: menuRecord.id,
            venueId: venue.id,
            name: category.name,
            color: category.color ?? null,
            sortOrder: category.sortOrder ?? 0,
            isActive: true,
          },
        });
        for (const item of category.items) {
          const createdItem = await tx.menuItem.create({
            data: {
              id: item.id,
              menuId: menuRecord.id,
              venueId: venue.id,
              categoryId: category.id,
              name: item.name,
              description: item.description ?? null,
              imageUrl: item.imageUrl ?? null,
              accentColor: item.accentColor ?? null,
              price: item.price,
              isActive: item.isActive ?? true,
              isInStock: item.isInStock ?? true,
              sortOrder: item.sortOrder ?? 0,
            },
          });
          await rewriteMenuItemModifiers(tx, createdItem.id, item.modifiers);
        }
      }
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'MENU_SEEDED', { template: 'demo' });
      return { menuVersion: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.menuVersion);
    const data = await loadMenuForVenue(venue, { includeInactive: true });
    return { ok: true, menu: data.menu, version: toMenuVersionString(data.version) };
  });

  app.get('/admin/menu/events', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const sinceRaw = (req.query as { sinceVersion?: string }).sinceVersion;
    const sinceVersion = sinceRaw ? Number(sinceRaw) : undefined;
    const eventsPayload = await listMenuEvents(staff.venueId, Number.isFinite(sinceVersion) ? sinceVersion : undefined);
    if (!eventsPayload) return reply.status(404).send({ message: 'Menu not found' });
    return eventsPayload;
  });

  app.get('/admin/tables', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const parsedQuery = TableListQuery.safeParse(req.query);
    if (!parsedQuery.success) return reply.status(400).send(parsedQuery.error.flatten());
    const query = parsedQuery.data;
    let pagination;
    try {
      pagination = parsePageParams(query, 50);
    } catch (err: any) {
      return reply.status(400).send({ message: err?.message ?? 'Invalid pagination params' });
    }
    const where = buildTableWhere(staff.venueId, query);
    const [tables, total] = await prisma.$transaction([
      prisma.table.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.table.count({ where }),
    ]);
    return { tables: tables.map(mapOwnerTable), pageInfo: buildPageInfo(pagination.page, pagination.pageSize, total) };
  });

  app.post('/admin/tables', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    if (!staff.venueId) return reply.status(400).send({ message: 'Admin user is not linked to a venue' });
    const parsed = AdminTableCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const table = await prisma.table.create({
      data: {
        id: parsed.data.code,
        venueId: staff.venueId,
        name: parsed.data.name,
        code: parsed.data.code,
        isActive: parsed.data.isActive,
      },
    });
    return { ok: true, table };
  });

  app.patch('/admin/tables/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const parsed = AdminTableUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const table = await prisma.table.update({ where: { id }, data: parsed.data });
    return { ok: true, table };
  });

  app.delete('/admin/tables/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    await prisma.table.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/admin/staff', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const parsedQuery = StaffListQuery.safeParse(req.query);
    if (!parsedQuery.success) return reply.status(400).send(parsedQuery.error.flatten());
    const query = parsedQuery.data;
    let pagination;
    try {
      pagination = parsePageParams(query, 50);
    } catch (err: any) {
      return reply.status(400).send({ message: err?.message ?? 'Invalid pagination params' });
    }
    const where = buildStaffWhere(staff.venueId, query);
    const [users, total] = await prisma.$transaction([
      prisma.staffUser.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.staffUser.count({ where }),
    ]);
    return { users: users.map(mapStaffUser), pageInfo: buildPageInfo(pagination.page, pagination.pageSize, total) };
  });

  app.post('/admin/staff', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const parsed = StaffCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    if (parsed.data.venueId !== staff.venueId) return reply.status(403).send({ message: 'Forbidden' });
    if (parsed.data.password && !isPasswordStrong(parsed.data.password)) {
      return reply.status(400).send({ message: 'Password must be at least 8 characters with upper, lower, and numeric characters' });
    }
    const tempPassword = parsed.data.password ?? generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.staffUser.create({
      data: {
        venueId: staff.venueId,
        role: parsed.data.role,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        passwordHash,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return { user: mapStaffUser(user), tempPassword: parsed.data.password ? undefined : tempPassword };
  });

  app.patch('/admin/staff/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const parsed = StaffUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const existing = await prisma.staffUser.findUnique({ where: { id } });
    if (!existing || existing.venueId !== staff.venueId) return reply.status(404).send({ message: 'Staff not found' });
    const data: any = { ...parsed.data };
    if (parsed.data.password && !isPasswordStrong(parsed.data.password)) {
      return reply.status(400).send({ message: 'Password must be at least 8 characters with upper, lower, and numeric characters' });
    }
    if (parsed.data.password) {
      data.passwordHash = await hashPassword(parsed.data.password);
    }
    delete data.password;
    if (data.venueId && data.venueId !== staff.venueId) return reply.status(403).send({ message: 'Forbidden' });
    const user = await prisma.staffUser.update({ where: { id }, data });
    return { user: mapStaffUser(user) };
  });

  app.get('/admin/tables/:id/qr', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table) return reply.status(404).send({ message: 'Table not found' });
    const venue = await prisma.venue.findUnique({ where: { id: table.venueId } });
    const venueSlug = venue?.slug ?? demoVenue.slug;
    const link = buildTableLink(venueSlug, table.code);
    const qr = await QRCode.toDataURL(link, { margin: 1, scale: 6, errorCorrectionLevel: 'M' });
    return { link, qr };
  });

  app.get('/admin/venues/:venueId/qr', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { venueId } = req.params as { venueId: string };
    if (!staff.venueId || staff.venueId !== venueId) return reply.status(403).send({ message: 'Forbidden' });
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const tables = await prisma.table.findMany({ where: { venueId }, orderBy: { name: 'asc' } });
    const payload = await Promise.all(
      tables.map(async (t) => {
        const link = buildTableLink(venue.slug, t.code);
        const qr = await QRCode.toDataURL(link, { margin: 1, scale: 6, errorCorrectionLevel: 'M' });
        return { tableId: t.id, code: t.code, name: t.name, link, qr };
      })
    );
    return { venue: { id: venue.id, name: venue.name, slug: venue.slug }, items: payload };
  });

  app.post('/admin/sessions/:sessionId/close', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { sessionId } = req.params as { sessionId: string };
    const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });
    await closeSession(sessionId, 'manual', io);
    return { ok: true, sessionId };
  });

  // Owner: venues
  app.get('/owner/venues', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const venues = await prisma.venue.findMany({ orderBy: { createdAt: 'desc' } });
    return { venues: venues.map((v: any) => mapOwnerVenue(v)) };
  });

  app.post('/owner/venues', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const parsed = OwnerVenueCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const created = await prisma.venue.create({ data: { ...parsed.data } });
    return mapOwnerVenue(created);
  });

  app.get('/owner/venues/:venueId', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    return mapOwnerVenue(venue);
  });

  app.patch('/owner/venues/:venueId', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const parsed = OwnerVenueUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const updated = await prisma.venue.update({ where: { id: venueId }, data: parsed.data });
    return mapOwnerVenue(updated);
  });

  app.delete('/owner/venues/:venueId', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const updated = await prisma.venue.update({ where: { id: venueId }, data: { isActive: false } });
    return mapOwnerVenue(updated);
  });

  // Owner: tables
  app.get('/owner/venues/:venueId/tables', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const parsedQuery = TableListQuery.safeParse({ ...(req.query as Record<string, any>), venueId });
    if (!parsedQuery.success) return reply.status(400).send(parsedQuery.error.flatten());
    const query = parsedQuery.data;
    let pagination;
    try {
      pagination = parsePageParams(query, 50);
    } catch (err: any) {
      return reply.status(400).send({ message: err?.message ?? 'Invalid pagination params' });
    }
    const where = buildTableWhere(venueId, query);
    const [tables, total] = await prisma.$transaction([
      prisma.table.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.table.count({ where }),
    ]);
    return { tables: tables.map(mapOwnerTable), pageInfo: buildPageInfo(pagination.page, pagination.pageSize, total) };
  });

  app.post('/owner/venues/:venueId/tables', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const parsed = OwnerTableCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    try {
      const created = await prisma.table.create({ data: { ...parsed.data, venueId } });
      return mapOwnerTable(created);
    } catch (err: any) {
      if (Prisma && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({ message: 'Table code already exists for this venue' });
      }
      throw err;
    }
  });

  app.post('/owner/venues/:venueId/tables/bulk', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const parsed = OwnerBulkTableCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const tablesData = Array.from({ length: parsed.data.count }).map((_, idx) => ({
      venueId,
      name: `${parsed.data.prefix}${idx + 1}`,
      code: `${parsed.data.prefix}${idx + 1}`,
      capacity: parsed.data.capacity,
      isActive: true,
    }));
    await prisma.table.createMany({ data: tablesData, skipDuplicates: true });
    const tables = await prisma.table.findMany({ where: { venueId }, orderBy: { name: 'asc' } });
    return { tables: tables.map(mapOwnerTable) };
  });

  app.patch('/owner/venues/:venueId/tables/:tableId', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { tableId } = req.params as { tableId: string };
    const parsed = OwnerTableUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const updated = await prisma.table.update({ where: { id: tableId }, data: parsed.data });
    return mapOwnerTable(updated);
  });

  app.get('/owner/venues/:venueId/qr', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const tables = await prisma.table.findMany({ where: { venueId }, orderBy: { name: 'asc' } });
    const payload = await Promise.all(
      tables.map(async (t) => {
        const link = buildTableLink(venue.slug, t.code);
        const qr = await QRCode.toDataURL(link, { margin: 1, scale: 6, errorCorrectionLevel: 'M' });
        return { tableId: t.id, code: t.code, name: t.name, link, qr };
      })
    );
    return { venue: { id: venue.id, name: venue.name, slug: venue.slug }, items: payload };
  });

  // Owner: menu management (DB-backed)
  app.get('/owner/venues/:venueId/menu', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const data = await loadMenuForVenue(venue, { includeInactive: true });
    return { ...data.menu, version: toMenuVersionString(data.version) };
  });

  app.post('/owner/venues/:venueId/menu', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const parsed = AdminMenuItemCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const accentColor = normalizeColor(parsed.data.accentColor);
    if (!isColorValid(accentColor)) {
      return reply.status(400).send({ message: 'Invalid accentColor format. Use hex like #RRGGBB.' });
    }
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);

    const result = await prisma.$transaction(async (tx) => {
      const category = await ensureMenuCategory(tx, menuRecord.id, venue.id, parsed.data.categoryId, parsed.data.name);
      const sortOrder = parsed.data.sortOrder ?? (await tx.menuItem.count({ where: { categoryId: category.id } }));
      const created = await tx.menuItem.create({
        data: {
          id: uid(),
          menuId: menuRecord.id,
          venueId: venue.id,
          categoryId: category.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          imageUrl: parsed.data.imageUrl ?? null,
          accentColor,
          price: parsed.data.price,
          isActive: parsed.data.isActive ?? true,
          isInStock: parsed.data.isInStock ?? true,
          sortOrder,
        },
      });
      if (parsed.data.modifiers?.length) {
        await rewriteMenuItemModifiers(tx, created.id, parsed.data.modifiers);
      }
      const fullItem = await tx.menuItem.findUnique({
        where: { id: created.id },
        include: { modifiers: { include: { options: true }, orderBy: { sortOrder: 'asc' } } },
      });
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'ITEM_CREATED', { itemId: created.id });
      return { item: fullItem!, version: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.version);
    return { ok: true, item: mapMenuItemFromDb(result.item as MenuItemWithModifiers) };
  });

  app.patch('/owner/venues/:venueId/menu/:itemId', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId, itemId } = req.params as { venueId: string; itemId: string };
    const parsed = AdminMenuItemUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const accentColor = parsed.data.accentColor !== undefined ? normalizeColor(parsed.data.accentColor) : undefined;
    if (parsed.data.accentColor !== undefined && !isColorValid(accentColor)) {
      return reply.status(400).send({ message: 'Invalid accentColor format. Use hex like #RRGGBB.' });
    }
    const existing = await prisma.menuItem.findUnique({ where: { id: itemId }, include: { modifiers: { include: { options: true } } } });
    if (!existing || existing.venueId !== venueId) return reply.status(404).send({ message: 'Menu item not found' });
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);

    const result = await prisma.$transaction(async (tx) => {
      let categoryId = existing.categoryId;
      if (parsed.data.categoryId && parsed.data.categoryId !== existing.categoryId) {
        const category = await ensureMenuCategory(tx, menuRecord.id, venue.id, parsed.data.categoryId, parsed.data.name ?? existing.name);
        categoryId = category.id;
      }
      const updateData: PrismaClientNamespace.MenuItemUncheckedUpdateInput = {};
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? null;
      if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl ?? null;
      if (parsed.data.accentColor !== undefined) updateData.accentColor = accentColor ?? null;
      if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
      if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
      if (parsed.data.isInStock !== undefined) updateData.isInStock = parsed.data.isInStock;
      if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
      if (categoryId !== existing.categoryId) updateData.categoryId = categoryId;

      const updatedItem = await tx.menuItem.update({ where: { id: itemId }, data: updateData });
      if (parsed.data.modifiers) {
        await rewriteMenuItemModifiers(tx, updatedItem.id, parsed.data.modifiers);
      }
      const fullItem = await tx.menuItem.findUnique({
        where: { id: itemId },
        include: { modifiers: { include: { options: true }, orderBy: { sortOrder: 'asc' } } },
      });
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'ITEM_UPDATED', { itemId });
      return { item: fullItem!, version: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.version);
    return { ok: true, item: mapMenuItemFromDb(result.item as MenuItemWithModifiers) };
  });

  app.delete('/owner/venues/:venueId/menu/:itemId', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId, itemId } = req.params as { venueId: string; itemId: string };
    const existing = await prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.venueId !== venueId) return reply.status(404).send({ message: 'Menu item not found' });
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);

    const result = await prisma.$transaction(async (tx) => {
      await tx.menuModifierOption.deleteMany({ where: { group: { itemId } } });
      await tx.menuModifierGroup.deleteMany({ where: { itemId } });
      await tx.menuItem.delete({ where: { id: itemId } });
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'ITEM_DELETED', { itemId });
      return { version: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.version);
    return { ok: true };
  });

  app.post('/owner/venues/:venueId/menu/seed', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.status(404).send({ message: 'Venue not found' });
    const menuRecord = await ensureMenuRecord(venue);
    const menu = cloneMenuForVenue(venue);

    const result = await prisma.$transaction(async (tx) => {
      await tx.menuModifierOption.deleteMany({ where: { group: { item: { menuId: menuRecord.id } } } });
      await tx.menuModifierGroup.deleteMany({ where: { item: { menuId: menuRecord.id } } });
      await tx.menuItem.deleteMany({ where: { menuId: menuRecord.id } });
      await tx.menuCategory.deleteMany({ where: { menuId: menuRecord.id } });
      for (const category of menu.categories) {
        await tx.menuCategory.create({
          data: {
            id: category.id,
            menuId: menuRecord.id,
            venueId: venue.id,
            name: category.name,
            color: category.color ?? null,
            sortOrder: category.sortOrder ?? 0,
            isActive: true,
          },
        });
        for (const item of category.items) {
          const createdItem = await tx.menuItem.create({
            data: {
              id: item.id,
              menuId: menuRecord.id,
              venueId: venue.id,
              categoryId: category.id,
              name: item.name,
              description: item.description ?? null,
              imageUrl: item.imageUrl ?? null,
              accentColor: item.accentColor ?? null,
              price: item.price,
              isActive: item.isActive ?? true,
              isInStock: item.isInStock ?? true,
              sortOrder: item.sortOrder ?? 0,
            },
          });
          await rewriteMenuItemModifiers(tx, createdItem.id, item.modifiers);
        }
      }
      const change = await recordMenuChange(tx, menuRecord.id, venue.id, 'MENU_SEEDED', { template: 'demo' });
      return { version: change.version };
    });

    await emitMenuUpdated(io, venue.id, result.version);
    const data = await loadMenuForVenue(venue, { includeInactive: true });
    return { ok: true, menu: data.menu, version: toMenuVersionString(data.version) };
  });

  app.get('/owner/venues/:venueId/menu/events', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const sinceRaw = (req.query as { sinceVersion?: string }).sinceVersion;
    const sinceVersion = sinceRaw ? Number(sinceRaw) : undefined;
    const eventsPayload = await listMenuEvents(venueId, Number.isFinite(sinceVersion) ? sinceVersion : undefined);
    if (!eventsPayload) return reply.status(404).send({ message: 'Menu not found' });
    return eventsPayload;
  });

  // Owner: platform-level tables/users with venue context
  app.get('/owner/tables', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const parsedQuery = TableListQuery.safeParse(req.query);
    if (!parsedQuery.success) return reply.status(400).send(parsedQuery.error.flatten());
    const query = parsedQuery.data;
    let pagination;
    try {
      pagination = parsePageParams(query, 50);
    } catch (err: any) {
      return reply.status(400).send({ message: err?.message ?? 'Invalid pagination params' });
    }
    const where = buildTableWhere(query.venueId, query);
    const [tables, total] = await prisma.$transaction([
      prisma.table.findMany({
        where,
        include: { venue: true },
        orderBy: [{ venueId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.table.count({ where }),
    ]);
    const data = tables.map((t: any) => ({
      ...mapOwnerTable(t),
      venue: { id: t.venue.id, name: t.venue.name, slug: t.venue.slug },
    }));
    return { tables: data, pageInfo: buildPageInfo(pagination.page, pagination.pageSize, total) };
  });

  app.get('/owner/users/all', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const parsedQuery = StaffListQuery.safeParse(req.query);
    if (!parsedQuery.success) return reply.status(400).send(parsedQuery.error.flatten());
    const query = parsedQuery.data;
    let pagination;
    try {
      pagination = parsePageParams(query, 50);
    } catch (err: any) {
      return reply.status(400).send({ message: err?.message ?? 'Invalid pagination params' });
    }
    const where = buildStaffWhere(query.venueId, query);
    const [users, total] = await prisma.$transaction([
      prisma.staffUser.findMany({
        where,
        include: { venue: true },
        orderBy: [{ venueId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.staffUser.count({ where }),
    ]);
    const data = users.map((u: any) => ({
      ...mapStaffUser(u),
      venue: u.venue ? { id: u.venue.id, name: u.venue.name, slug: u.venue.slug } : undefined,
    }));
    return { users: data, pageInfo: buildPageInfo(pagination.page, pagination.pageSize, total) };
  });

  // Owner: users
  app.get('/owner/venues/:venueId/users', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const parsedQuery = StaffListQuery.safeParse({ ...(req.query as Record<string, any>), venueId });
    if (!parsedQuery.success) return reply.status(400).send(parsedQuery.error.flatten());
    const query = parsedQuery.data;
    let pagination;
    try {
      pagination = parsePageParams(query, 50);
    } catch (err: any) {
      return reply.status(400).send({ message: err?.message ?? 'Invalid pagination params' });
    }
    const where = buildStaffWhere(venueId, query);
    const [users, total] = await prisma.$transaction([
      prisma.staffUser.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.staffUser.count({ where }),
    ]);
    return { users: users.map((u: any) => mapStaffUser(u)), pageInfo: buildPageInfo(pagination.page, pagination.pageSize, total) };
  });

  app.post('/owner/venues/:venueId/users', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const parsed = OwnerStaffCreateDto.safeParse({ ...(req.body ?? {}), venueId });
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    if (!isPasswordStrong(parsed.data.password)) {
      return reply.status(400).send({ message: 'Password must be at least 8 characters with upper, lower, and numeric characters' });
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const { password: _omit, ...rest } = parsed.data;
    const created = await prisma.staffUser.create({
      data: { ...rest, passwordHash, role: parsed.data.role, venueId },
    });
    return mapStaffUser(created);
  });

  app.patch('/owner/venues/:venueId/users/:userId', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { userId } = req.params as { userId: string };
    const parsed = OwnerStaffUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const data: any = { ...parsed.data };
    if (parsed.data.password && !isPasswordStrong(parsed.data.password)) {
      return reply.status(400).send({ message: 'Password must be at least 8 characters with upper, lower, and numeric characters' });
    }
    if (parsed.data.password) {
      data.passwordHash = await hashPassword(parsed.data.password);
    }
    delete data.password;
    const updated = await prisma.staffUser.update({ where: { id: userId }, data });
    return mapStaffUser(updated);
  });

  // Owner: stats (basic)
  const computeStats = async (venueId?: string) => {
    const orderWhere = venueId ? { venueId } : {};
    const orders = await prisma.order.findMany({ where: orderWhere, include: { items: { include: { modifiers: true } } } });
    const ordersByStatus = Object.values(OrderStatusEnum.enum).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<OrderStatus, number>
    );
    orders.forEach((o: any) => {
      const status = o.status as OrderStatus;
      if (status in ordersByStatus) {
        ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;
      }
    });

    const now = new Date();
    const daysBack = (days: number) => {
      const arr: Array<{ date: string; count: number }> = [];
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const count = orders.filter((o: any) => o.createdAt.toISOString().startsWith(key)).length;
        arr.push({ date: key, count });
      }
      return arr;
    };

    const revenue = orders.reduce((sum: number, order: any) => sum + calcOrderTotal(mapOrder(order, order.items)), 0);

    const itemAgg = new Map<string, { qty: number; revenue: number }>();
    orders.forEach((o: any) => {
      o.items.forEach((i: any) => {
        const modSum = i.modifiers.reduce((m: number, mod: any) => m + mod.priceDelta, 0);
        const line = (i.unitPrice + modSum) * i.qty;
        const existing = itemAgg.get(i.itemName) ?? { qty: 0, revenue: 0 };
        existing.qty += i.qty;
        existing.revenue += line;
        itemAgg.set(i.itemName, existing);
      });
    });

    const topItems = Array.from(itemAgg.entries())
      .map(([itemName, stats]) => ({ itemName, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return OwnerStatsDto.parse({
      ordersByStatus,
      ordersLast7d: daysBack(7),
      ordersLast30d: daysBack(30),
      revenue,
      topItems,
    });
  };

  app.get('/owner/stats', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const stats = await computeStats();
    return stats;
  });

  app.get('/owner/venues/:venueId/stats', async (req, reply) => {
    const owner = await requireOwner(req, reply);
    if (!owner) return;
    const { venueId } = req.params as { venueId: string };
    const stats = await computeStats(venueId);
    return stats;
  });

  const server = app.server;
  io = new IOServer(server, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (isOriginAllowed(requestOrigin)) return callback(null, true);
        callback(new Error('Origin not allowed'), false);
      },
    },
  });

  // background inactivity closer & TTL cleanup
  setInterval(async () => {
    try {
      const nowMs = Date.now();
      const inactiveCutoff = new Date(nowMs - SESSION_INACTIVITY_MS);
      const sessions = await prisma.tableSession.findMany({
        where: { status: TableSessionStatusEnum.enum.OPEN, lastActiveAt: { lte: inactiveCutoff } },
        select: { id: true },
      });
      for (const s of sessions) {
        await closeSession(s.id, 'inactive', io);
      }
    } catch (err) {
      handlePrismaError(err, 'inactivity cleanup failed');
    }
  }, 60_000);

  setInterval(async () => {
    try {
      const sessionCutoff = new Date(Date.now() - CLOSED_SESSION_TTL_MS);
      const servedCutoff = new Date(Date.now() - SERVED_ORDER_TTL_MS);

      const closedSessions = await prisma.tableSession.findMany({
        where: { status: TableSessionStatusEnum.enum.CLOSED, closedAt: { lte: sessionCutoff } },
        select: { id: true },
      });
      if (closedSessions.length) {
        const ids = closedSessions.map((s) => s.id);
        await prisma.$transaction([
          prisma.orderItemModifier.deleteMany({ where: { orderItem: { order: { sessionId: { in: ids } } } } }),
          prisma.orderItem.deleteMany({ where: { order: { sessionId: { in: ids } } } }),
          prisma.order.deleteMany({ where: { sessionId: { in: ids } } }),
          prisma.cartItemModifier.deleteMany({ where: { cartItem: { sessionId: { in: ids } } } }),
          prisma.cartItem.deleteMany({ where: { sessionId: { in: ids } } }),
          prisma.paymentIntent.deleteMany({ where: { sessionId: { in: ids } } }),
          prisma.tableSession.deleteMany({ where: { id: { in: ids } } }),
        ]);
        ids.forEach((id) => revokeSessionTokens(id));
      }

      const servedOrders = await prisma.order.findMany({
        where: { status: OrderStatusEnum.enum.SERVED, servedAt: { lte: servedCutoff } },
        select: { id: true },
      });
      if (servedOrders.length) {
        const ids = servedOrders.map((o) => o.id);
        await prisma.$transaction([
          prisma.orderItemModifier.deleteMany({ where: { orderItem: { orderId: { in: ids } } } }),
          prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }),
          prisma.paymentIntent.deleteMany({ where: { orderId: { in: ids } } }),
          prisma.order.deleteMany({ where: { id: { in: ids } } }),
        ]);
      }
    } catch (err) {
      handlePrismaError(err, 'ttl cleanup failed');
    }
  }, 5 * 60_000);

  io.on('connection', (socket) => {
    socket.on('kitchen.subscribe', (payload) => {
      const parsed = WaiterSubscribeDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const staff = verifyStaffJwt(parsed.data.token);
      if (!staff || staff.venueId !== parsed.data.venueId || ![UserRoleEnum.enum.KITCHEN, UserRoleEnum.enum.ADMIN].includes(staff.role as any)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Forbidden' }));
        return;
      }
      socket.join(buildKitchenRoom(parsed.data.venueId));
    });

    socket.on('waiter.subscribe', (payload) => {
      const parsed = WaiterSubscribeDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const staff = verifyStaffJwt(parsed.data.token);
      if (!staff || staff.venueId !== parsed.data.venueId || ![UserRoleEnum.enum.WAITER, UserRoleEnum.enum.ADMIN].includes(staff.role as any)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Forbidden' }));
        return;
      }
      socket.join(buildWaitersRoom(parsed.data.venueId));
    });

    socket.on('session.join', async (payload) => {
      const parsed = JoinSessionSocketDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId }, include: { table: true } });
      if (!session) {
        socket.emit('error', ErrorEventDto.parse({ code: 'SESSION_NOT_FOUND', message: 'Session not found' }));
        return;
      }
      if (!isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Invalid session token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }
      await prisma.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso(), peopleCount: parsed.data.peopleCount ?? undefined } });
      socket.join(buildSessionRoom(session.id));
      const state = await getSessionState(session.id);
      if (state) socket.emit('session.state', SessionStateEventDto.parse(state));
    });

    socket.on('cart.addItem', async (payload) => {
      const parsed = CartAddItemDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      try {
        const result = await addCartItemForSession({
          sessionId: parsed.data.sessionId,
          token: parsed.data.token,
          menuItemId: parsed.data.menuItemId,
          qty: parsed.data.qty,
          modifiers: parsed.data.modifiers ?? [],
          note: parsed.data.note,
        });
        emitTableStateChanged(io, parsed.data.sessionId, 'cart');
      } catch (err: any) {
        const message = err?.message ?? 'Add to cart failed';
        const code = err?.code ?? 'CART_ADD_FAILED';
        socket.emit('error', ErrorEventDto.parse({ code, message }));
      }
    });

    socket.on('session.leave', async (payload) => {
      const parsed = SessionLeaveDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId } });
      if (!session) return;
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
      }
      socket.leave(buildSessionRoom(parsed.data.sessionId));
    });

    socket.on('table.assistanceRequested', async (payload) => {
      const parsed = AssistanceRequestDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId }, include: { table: true } });
      if (!session) {
        socket.emit('error', ErrorEventDto.parse({ code: 'SESSION_NOT_FOUND', message: 'Session not found' }));
        return;
      }
      if (!isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Invalid session token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }
      await prisma.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso() } });
      const assistancePayload = {
        sessionId: session.id,
        tableId: session.tableId,
        venueId: session.venueId,
        message: parsed.data.message,
        deviceHash: parsed.data.deviceHash,
      };
      io?.to(buildWaitersRoom(session.venueId)).emit('table.assistanceRequested', {
        ...assistancePayload,
      });
      io?.to(buildSessionRoom(session.id)).emit('table.assistanceRequested', assistancePayload);
    });

    socket.on('cart.updateItemQty', async (payload) => {
      const parsed = CartUpdateItemQtyDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      try {
        const result = await updateCartItemQtyForSession({
          sessionId: parsed.data.sessionId,
          token: parsed.data.token,
          cartItemId: parsed.data.cartItemId,
          qty: parsed.data.qty,
        });
        io?.to(buildSessionRoom(parsed.data.sessionId)).emit(
          'cart.updated',
          CartUpdatedEventDto.parse({ cart: result.cart, totals: result.totals })
        );
        emitTableStateChanged(io, parsed.data.sessionId, 'cart');
      } catch (err: any) {
        const message = err?.message ?? 'Update cart failed';
        const code = err?.code ?? 'CART_UPDATE_FAILED';
        socket.emit('error', ErrorEventDto.parse({ code, message }));
      }
    });

    socket.on('cart.removeItem', async (payload) => {
      const parsed = CartRemoveItemDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      try {
        const result = await removeCartItemForSession({
          sessionId: parsed.data.sessionId,
          token: parsed.data.token,
          cartItemId: parsed.data.cartItemId,
        });
        io?.to(buildSessionRoom(parsed.data.sessionId)).emit(
          'cart.updated',
          CartUpdatedEventDto.parse({ cart: result.cart, totals: result.totals })
        );
        emitTableStateChanged(io, parsed.data.sessionId, 'cart');
      } catch (err: any) {
        const message = err?.message ?? 'Remove cart item failed';
        const code = err?.code ?? 'CART_REMOVE_FAILED';
        socket.emit('error', ErrorEventDto.parse({ code, message }));
      }
    });

    socket.on('order.submit', async (payload) => {
      const parsed = OrderSubmitDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      try {
        await submitOrderForSession({
          sessionId: parsed.data.sessionId,
          token: parsed.data.token,
          clientOrderKey: parsed.data.clientOrderKey,
          comment: parsed.data.comment,
          io,
        });
      } catch (err: any) {
        if (err?.statusCode === 409) {
          socket.emit('error', ErrorEventDto.parse({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key reuse with different payload' }));
          return;
        }
        throw err;
      }
    });

    socket.on('order.markServed', async (payload) => {
      const parsed = OrderMarkServedDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId }, include: { items: { include: { modifiers: true } } } });
      if (!order) {
        socket.emit('error', ErrorEventDto.parse({ code: 'ORDER_NOT_FOUND', message: 'Order not found' }));
        return;
      }
      if (order.status !== OrderStatusEnum.enum.READY) {
        socket.emit('error', ErrorEventDto.parse({ code: 'INVALID_STATE', message: 'Order not ready' }));
        return;
      }
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatusEnum.enum.SERVED, servedAt: nowIso(), updatedAt: nowIso() },
        include: { items: { include: { modifiers: true } } },
      });
      emitOrderUpdated(io!, mapOrder(updated, updated.items));
      emitTableStateChanged(io, order.sessionId, 'order');
    });

    socket.on('payment.create', async (payload) => {
      const parsed = PaymentCreateDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }

      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId } });
      if (!session || !isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'SESSION_NOT_FOUND', message: 'Session not found or invalid token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }

      const idempotencyKey = parsed.data.idempotencyKey ?? getIdempotencyKey({ headers: socket.handshake.headers });
      const quoteForHash = await (prisma as any).paymentQuote.findUnique({ where: { id: parsed.data.quoteId } });
      const requestHash = computeRequestHash({
        sessionId: session.id,
        quoteId: parsed.data.quoteId,
        tipPercent: parsed.data.tipPercent ?? null,
        tipAmount: parsed.data.tipAmount ?? null,
        amount: quoteForHash?.amount ?? null,
      });
      const runAndEmit = async (): Promise<{ statusCode: number; body: any }> => {
        try {
          const payment = await createPaymentForQuote(session.id, parsed.data.quoteId, {
            tipPercent: parsed.data.tipPercent,
            tipAmount: parsed.data.tipAmount ?? undefined,
            paidByDeviceHash: parsed.data.paidByDeviceHash,
            io,
          });
          emitPaymentUpdated(io!, payment);
          return { statusCode: 200, body: PaymentCreateResponseDto.parse({ payment }) };
        } catch (err: any) {
          const status = err?.status ?? 500;
          return { statusCode: status, body: { message: err?.message, code: err?.code } };
        }
      };

      if (idempotencyKey) {
        try {
          const result = await withIdempotency(
            prisma as any,
            {
              scope: 'payment.create',
              key: idempotencyKey,
              requestHash,
              metadata: { sessionId: session.id, tableId: session.tableId, venueId: session.venueId },
            },
            runAndEmit
          );
          if (result.statusCode !== 200) {
            socket.emit('error', ErrorEventDto.parse({ code: 'PAYMENT_FAILED', message: result.body.message ?? 'Payment failed' }));
            return;
          }
          if (result.replay) {
            emitPaymentUpdated(io!, result.body.payment);
          }
          return;
        } catch (err: any) {
          if (err?.statusCode === 409) {
            socket.emit('error', ErrorEventDto.parse({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key collision' }));
            return;
          }
          throw err;
        }
      }

      const result = await runAndEmit();
      if (result.statusCode !== 200) {
        socket.emit('error', ErrorEventDto.parse({ code: 'PAYMENT_FAILED', message: result.body.message ?? 'Payment failed' }));
      }
    });
  });

  const port = Number(process.env.API_PORT || 4000);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`API listening on http://localhost:${port}`);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

export {
  computeOutstanding,
  calcCartTotals,
  calcCartItemsTotal,
  calcOrdersTotal,
  calcOrderTotal,
  addCartItemForSession,
  updateCartItemQtyForSession,
  removeCartItemForSession,
  removeOrderItemForSession,
  handleAssistanceRequest,
  registerSessionToken,
  submitOrderForSession,
  getSessionState as __testGetSessionState,
  createPaymentQuote,
  createPaymentForQuote,
  createOrUpdateSplitPlan,
};
