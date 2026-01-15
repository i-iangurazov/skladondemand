import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __setTestPrisma,
  calcCartItemsTotal,
  calcCartTotals,
  calcOrdersTotal,
  computeOutstanding,
  isOriginAllowed,
  buildTableWhere,
  buildStaffWhere,
  buildOrdersWhere,
  addCartItemForSession,
  handleAssistanceRequest,
  registerSessionToken,
  submitOrderForSession,
  updateCartItemQtyForSession,
  removeCartItemForSession,
  removeOrderItemForSession,
  __testGetSessionState,
  createPaymentQuote,
  createPaymentForQuote,
  createOrUpdateSplitPlan,
} from './server';
import { issuePlatformAccessToken, issueStaffAccessToken, verifyPlatformJwt, verifyStaffJwt } from './lib/authTokens';
import { createStaffService } from './lib/staffService';
import { parsePageParams, buildPageInfo } from './lib/pagination';
import { withIdempotency, computeRequestHash } from './lib/idempotency';
import {
  OrderStatusEnum,
  PaymentStatusEnum,
  TableSessionStatusEnum,
  UserRoleEnum,
  type CartItem,
  type Order,
  type PaymentIntent,
} from '@qr/types';

const nowIso = () => new Date().toISOString();

const makeCartItem = (id: string, unitPrice: number, qty = 1): CartItem => ({
  id,
  sessionId: 's1',
  menuItemId: `m-${id}`,
  qty,
  unitPrice,
  itemName: `Item ${id}`,
  modifiers: [],
});

const makeOrder = (id: string, prices: number[]): Order => ({
  id,
  venueId: 'v1',
  sessionId: 's1',
  tableId: 't1',
  status: OrderStatusEnum.enum.NEW,
  number: 1,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  items: prices.map((price, idx) => ({
    id: `${id}-item-${idx}`,
    orderId: id,
    menuItemId: `m-${idx}`,
    qty: 1,
    unitPrice: price,
    itemName: `Item ${idx}`,
    modifiers: [],
    paidCents: 0,
    remainingCents: price,
  })),
});

const buildAllocMap = (allocs: Array<{ orderItemId: string; amountCents: number }>) => {
  const map = new Map<string, number>();
  allocs.forEach((a) => {
    map.set(a.orderItemId, (map.get(a.orderItemId) ?? 0) + a.amountCents);
  });
  return map;
};

const makeIdempotencyPrisma = () => {
  const store: any[] = [];
  const findRow = (scope: string, key: string) => store.find((r) => r.scope === scope && r.key === key) ?? null;
  return {
    store,
    prisma: {
      idempotencyKey: {
        findUnique: async ({ where: { scope_key } }: any) => findRow(scope_key.scope, scope_key.key),
        create: async ({ data }: any) => {
          if (findRow(data.scope, data.key)) {
            throw new Error('Unique constraint');
          }
          const row = { id: `id-${store.length + 1}`, ...data };
          store.push(row);
          return row;
        },
        update: async ({ where: { scope_key }, data }: any) => {
          const row = findRow(scope_key.scope, scope_key.key);
          if (!row) throw new Error('Not found');
          Object.assign(row, data);
          return row;
        },
      },
    },
  };
};

const makePaymentPrismaMock = (opts?: { orderPrices?: number[]; peopleCount?: number }) => {
  const payments: any[] = [];
  const quotes: any[] = [];
  const splitPlans: any[] = [];
  const allocations: any[] = [];
  const now = new Date();
  const orderItems =
    opts?.orderPrices?.map((price, idx) => ({
      id: `oi-${idx + 1}`,
      orderId: 'o1',
      menuItemId: `m-${idx + 1}`,
      qty: 1,
      unitPrice: price,
      itemName: `Item ${idx + 1}`,
      modifiers: [],
    })) ?? [
      {
        id: 'oi-1',
        orderId: 'o1',
        menuItemId: 'm-1',
        qty: 1,
        unitPrice: 1000,
        itemName: 'Item 1',
        modifiers: [],
      },
    ];
  const orders = [
    {
      id: 'o1',
      venueId: 'v1',
      sessionId: 's-pay',
      tableId: 't1',
      status: OrderStatusEnum.enum.NEW,
      number: 1,
      createdAt: now,
      updatedAt: now,
      items: orderItems,
    },
  ];
  const session = {
    id: 's-pay',
    venueId: 'v1',
    tableId: 't1',
    status: TableSessionStatusEnum.enum.OPEN,
    peopleCount: opts?.peopleCount ?? 2,
    openedAt: now,
    lastActiveAt: now,
    stateVersion: 1,
    venue: { id: 'v1', currency: 'KGS' },
  };
  const prismaMock: any = {
    _orders: orders,
    _payments: payments,
    _quotes: quotes,
    _splitPlans: splitPlans,
    _allocations: allocations,
    paymentIntent: {
      findMany: async ({ where }: any) =>
        payments.filter(
          (p) =>
            (!where?.sessionId || p.sessionId === where.sessionId) &&
            (!where?.status?.in || where.status.in.includes(p.status)) &&
            (!where?.status || where.status === p.status || where.status?.in?.includes?.(p.status))
        ),
      findUnique: async ({ where: { id } }: any) => payments.find((p) => p.id === id) ?? null,
      aggregate: async ({ where }: any) => {
        const filtered = payments.filter(
          (p) =>
            (!where?.splitPlanId || p.splitPlanId === where.splitPlanId) &&
            (!where?.status || p.status === where.status) &&
            (!where?.sessionId || p.sessionId === where.sessionId)
        );
        return {
          _sum: {
            sharesPaid: filtered.reduce((sum, p) => sum + (p.sharesPaid ?? 0), 0),
          },
        };
      },
      create: async ({ data }: any) => {
        const row = { ...data };
        payments.push(row);
        return row;
      },
      update: async ({ where: { id }, data }: any) => {
        const row = payments.find((p) => p.id === id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return row;
      },
    },
    paymentQuote: {
      create: async ({ data }: any) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date() };
        quotes.push(row);
        return row;
      },
      findUnique: async ({ where: { id } }: any) => quotes.find((q) => q.id === id) ?? null,
      delete: async ({ where: { id } }: any) => {
        const idx = quotes.findIndex((q) => q.id === id);
        if (idx >= 0) quotes.splice(idx, 1);
        return null;
      },
    },
    orderItem: {
      findUnique: async ({ where: { id } }: any) => {
        const itm = orderItems.find((o) => o.id === id);
        if (!itm) return null;
        const order = orders.find((o) => o.id === itm.orderId);
        const itemAllocations = allocations.filter((a) => a.orderItemId === id);
        return { ...itm, order, allocations: itemAllocations };
      },
    },
    menu: {
      findUnique: async () => ({ version: 1 }),
    },
    paymentAllocation: {
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : data?.map ? data : [];
        if (Array.isArray(data)) {
          data.forEach((alloc: any) => allocations.push({ ...alloc }));
        } else if (data) {
          allocations.push({ ...data });
        }
        return { count: list.length || (data ? 1 : 0) };
      },
      findMany: async ({ where }: any) =>
        allocations.filter(
          (a) =>
            (!where?.orderItemId || a.orderItemId === where.orderItemId) &&
            (!where?.paymentId || a.paymentId === where.paymentId)
        ),
    },
    splitPlan: {
      findFirst: async ({ where }: any) =>
        splitPlans.find((p) => p.sessionId === where.sessionId) ?? null,
      findUnique: async ({ where: { id } }: any) => splitPlans.find((p) => p.id === id) ?? null,
      create: async ({ data }: any) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        splitPlans.push(row);
        return row;
      },
      update: async ({ where: { id }, data }: any) => {
        const idx = splitPlans.findIndex((p) => p.id === id);
        if (idx === -1) throw new Error('not found');
        splitPlans[idx] = { ...splitPlans[idx], ...data };
        return splitPlans[idx];
      },
    },
    tableSession: {
      findUnique: async ({ where: { id } }: any) => {
        if (id !== session.id) return null;
        const mappedOrders = orders.map((order) => ({
          ...order,
          items: order.items.map((itm) => ({
            ...itm,
            allocations: allocations.filter(
              (alloc) =>
                alloc.orderItemId === itm.id &&
                payments.find((p) => p.id === alloc.paymentId)?.status === PaymentStatusEnum.enum.PAID
            ),
          })),
        }));
        return { ...session, cartItems: [], orders: mappedOrders, payments, table: { id: 't1', name: 'T1' } };
      },
      update: async ({ data }: any) => {
        if (data.stateVersion?.increment) {
          session.stateVersion = (session.stateVersion ?? 1) + data.stateVersion.increment;
        }
        if (data.lastActiveAt) {
          session.lastActiveAt = data.lastActiveAt;
        }
        if (data.peopleCount !== undefined) {
          session.peopleCount = data.peopleCount;
        }
        return session;
      },
    },
    cartItem: { findMany: async () => [] },
    menuChangeEvent: { aggregate: async () => ({ _max: { version: 1 } }) },
    table: { findUnique: async () => ({ id: session.tableId, venueId: session.venueId }) },
    $queryRaw: async () => [],
  };
  prismaMock.$transaction = async (cb: any) => cb(prismaMock);
  return prismaMock;
};

const mapOrdersForTest = (orders: any[]): Order[] =>
  orders.map((o) => ({
    id: o.id,
    venueId: o.venueId,
    sessionId: o.sessionId,
    tableId: o.tableId,
    status: o.status,
    number: o.number,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    items: o.items.map((itm: any) => ({
      ...itm,
      modifiers: itm.modifiers ?? [],
      paidCents: itm.paidCents ?? 0,
      remainingCents:
        itm.remainingCents ??
        (typeof itm.unitPrice === 'number' && typeof itm.qty === 'number'
          ? itm.unitPrice * itm.qty
          : 0),
    })),
  }));

describe('payments contract regressions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('disallows deleting paid order items', async () => {
    const prismaMock = makePaymentPrismaMock({ orderPrices: [500] });
    __setTestPrisma(prismaMock as any);
    const orderItemId = prismaMock._orders[0].items[0].id;
    prismaMock._allocations.push({ paymentId: 'p1', orderItemId, amountCents: 500 });
    prismaMock._payments.push({
      id: 'p1',
      venueId: 'v1',
      sessionId: 's-pay',
      amount: 500,
      status: PaymentStatusEnum.enum.PAID,
      provider: 'mock',
      payload: { baseAmount: 500 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      removeOrderItemForSession({ sessionId: 's-pay', token: 'tok', orderItemId })
    ).rejects.toMatchObject({ status: 401 }); // missing token registration

    registerSessionToken('s-pay', 'tok');
    await expect(
      removeOrderItemForSession({ sessionId: 's-pay', token: 'tok', orderItemId })
    ).rejects.toMatchObject({ status: 409, code: 'PAID_ITEM' });
  });

  it('allocates selected item payment and rejects re-pay', async () => {
    const prismaMock = makePaymentPrismaMock({ orderPrices: [300, 700] });
    __setTestPrisma(prismaMock as any);
    registerSessionToken('s-pay', 'tok');
    const selectedId = prismaMock._orders[0].items[0].id;

    const { quote } = await createPaymentQuote('s-pay', {
      mode: 'SELECTED',
      stateVersion: 1,
      selectedOrderItemIds: [selectedId],
    });
    expect(quote.amount).toBe(300);
    await createPaymentForQuote('s-pay', quote.id, {});

    const outstanding = computeOutstanding(mapOrdersForTest(prismaMock._orders), buildAllocMap(prismaMock._allocations));
    expect(outstanding.remaining).toBe(700);

    await expect(
      createPaymentQuote('s-pay', {
        mode: 'SELECTED',
        stateVersion: 2,
        selectedOrderItemIds: [selectedId],
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('stabilizes even split shares and ends at zero', async () => {
    const prismaMock = makePaymentPrismaMock({ orderPrices: [1000], peopleCount: 2 });
    __setTestPrisma(prismaMock as any);
    registerSessionToken('s-pay', 'tok');
    const plan = await createOrUpdateSplitPlan('s-pay', 2);

    const firstQuote = await createPaymentQuote('s-pay', {
      mode: 'EVEN',
      stateVersion: plan.stateVersion,
      splitPlanId: plan.plan.id,
      sharesToPay: 1,
    });
    expect(firstQuote.quote.amount).toBe(500);
    await createPaymentForQuote('s-pay', firstQuote.quote.id, {});

    const secondQuote = await createPaymentQuote('s-pay', {
      mode: 'EVEN',
      stateVersion: plan.stateVersion + 1,
      splitPlanId: plan.plan.id,
      sharesToPay: 1,
    });
    expect(secondQuote.quote.amount).toBe(500);
    await createPaymentForQuote('s-pay', secondQuote.quote.id, {});

    const outstanding = computeOutstanding(mapOrdersForTest(prismaMock._orders), buildAllocMap(prismaMock._allocations));
    expect(outstanding.remaining).toBe(0);
    await expect(
      createPaymentQuote('s-pay', {
        mode: 'EVEN',
        stateVersion: plan.stateVersion + 2,
        splitPlanId: plan.plan.id,
        sharesToPay: 1,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects stale payment when stateVersion advanced', async () => {
    const prismaMock = makePaymentPrismaMock({ orderPrices: [500, 500] });
    __setTestPrisma(prismaMock as any);
    registerSessionToken('s-pay', 'tok');

    const { quote } = await createPaymentQuote('s-pay', { mode: 'FULL', stateVersion: 1 });
    prismaMock._payments.push({
      id: 'p-new',
      venueId: 'v1',
      sessionId: 's-pay',
      amount: 500,
      status: PaymentStatusEnum.enum.PAID,
      provider: 'mock',
      payload: { baseAmount: 500 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await prismaMock.tableSession.update({ where: { id: 's-pay' }, data: { stateVersion: { increment: 1 } } });

    await expect(createPaymentForQuote('s-pay', quote.id, {})).rejects.toMatchObject({ status: 409 });
  });
});

describe('cart and order totals', () => {
  it('computes cart totals including quantity', () => {
    const cart = [makeCartItem('c1', 500, 2), makeCartItem('c2', 300, 1)];

    const totals = calcCartTotals(cart);

    expect(totals.subtotal).toBe(1300);
    expect(totals.total).toBe(1300);
    expect(totals.itemCount).toBe(3);
  });

  it('computes cart items total with modifiers', () => {
    const cart: CartItem[] = [
      { ...makeCartItem('c1', 500, 1), modifiers: [{ optionId: 'm1', optionName: 'Extra', priceDelta: 100 }] },
      { ...makeCartItem('c2', 400, 2), modifiers: [] },
    ];

    expect(calcCartItemsTotal(cart)).toBe(500 + 100 + 400 * 2);
  });

  it('computes order totals', () => {
    const orders = [makeOrder('o1', [500, 700]), makeOrder('o2', [300])];

    expect(calcOrdersTotal(orders)).toBe(1500);
  });
});

describe('auth and cors hardening', () => {
  it('allows localhost origin and blocks unknown origins', () => {
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('https://evil.example.com')).toBe(false);
  });

  it('rejects platform token for staff verification and vice versa', () => {
    const platformToken = issuePlatformAccessToken({ id: 'p1', role: UserRoleEnum.enum.PLATFORM_OWNER });
    const staffToken = issueStaffAccessToken({ id: 's1', role: UserRoleEnum.enum.ADMIN, venueId: 'v1' });

    expect(verifyStaffJwt(platformToken)).toBeNull();
    expect(verifyPlatformJwt(staffToken)).toBeNull();
  });

  it('revokes refresh token on logout flow', async () => {
    const sessions: any[] = [];
    const prismaMock = {
      staffSession: {
        create: async ({ data }: any) => {
          const row = { id: `sess-${sessions.length + 1}`, revokedAt: null, ...data };
          sessions.push(row);
          return row;
        },
        updateMany: async ({ where, data }: any) => {
          sessions.forEach((s) => {
            if (s.tokenHash === where.tokenHash && s.revokedAt === null) {
              s.revokedAt = data.revokedAt;
            }
          });
        },
        findFirst: async ({ where }: any) =>
          sessions.find(
            (s) =>
              s.tokenHash === where.tokenHash &&
              s.revokedAt === null &&
              s.expiresAt > new Date()
          ) ?? null,
      },
    };
    const staffService = createStaffService(prismaMock as any);

    const { refreshToken } = await staffService.createRefreshSession('user-1');
    const before = await staffService.findRefreshSession(refreshToken);
    expect(before).not.toBeNull();

    await staffService.revokeRefreshSession(refreshToken);
    const after = await staffService.findRefreshSession(refreshToken);
    expect(after).toBeNull();
  });
});

describe('guest critical flows', () => {
  const cartStore: any[] = [];
  const orderStore: any[] = [];
  const tableSession = { id: 's1', venueId: 'v1', tableId: 't1', status: 'OPEN', lastActiveAt: nowIso() };

  const makePrismaMock = () => {
    const idempotencyStore: any[] = [];
    const findKey = (scope: string, key: string) => idempotencyStore.find((r) => r.scope === scope && r.key === key) ?? null;
    const orderItemModifierStore: any[] = [];
    const mock: any = {
      tableSession: {
        findUnique: vi.fn(async ({ where: { id } }) => (id === 's1' ? { ...tableSession } : null)),
        update: vi.fn(async () => tableSession),
      },
      menuItem: {
        findFirst: vi.fn(async () => ({
          id: 'm1',
          venueId: 'v1',
          name: 'Item 1',
          price: 500,
          isActive: true,
          isInStock: true,
          modifiers: [
            {
              id: 'g1',
              name: 'Pick',
              minSelect: 0,
              maxSelect: 1,
              isRequired: false,
              sortOrder: 0,
              options: [{ id: 'o1', name: 'A', priceDelta: 0, isActive: true, sortOrder: 0 }],
            },
          ],
        })),
      },
      cartItem: {
        create: vi.fn(async ({ data }) => {
          cartStore.push({ ...data, modifiers: [] });
          return data;
        }),
        findMany: vi.fn(async () => cartStore.map((c) => ({ ...c, modifiers: [] }))),
      },
      cartItemModifier: {
        createMany: vi.fn(async () => undefined),
      },
      idempotencyKey: {
        findUnique: vi.fn(async ({ where: { scope_key } }) => findKey(scope_key.scope, scope_key.key)),
        create: vi.fn(async ({ data }) => {
          if (findKey(data.scope, data.key)) throw new Error('Unique constraint');
          const row = { id: `ik-${idempotencyStore.length + 1}`, ...data };
          idempotencyStore.push(row);
          return row;
        }),
        update: vi.fn(async ({ where: { scope_key }, data }) => {
          const row = findKey(scope_key.scope, scope_key.key);
          if (!row) throw new Error('Not found');
          Object.assign(row, data);
          return row;
        }),
      },
    };
    mock.$transaction = async (cb: any) => cb(mock);
    mock.order = {
      aggregate: vi.fn(async () => ({ _max: { number: orderStore.reduce((max, o) => Math.max(max, o.number ?? 0), 0) } })),
      create: vi.fn(async ({ data }) => {
        const row = {
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        };
        orderStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where: { id } }) => {
        const base = orderStore.find((o) => o.id === id);
        if (!base) return null;
        const items = mock.orderItem._store
          .filter((i: any) => i.orderId === id)
          .map((i: any) => ({
            ...i,
            modifiers: orderItemModifierStore.filter((m) => m.orderItemId === i.id),
          }));
        return { ...base, items };
      }),
    };
    mock.orderItem = {
      _store: [] as any[],
      create: vi.fn(async ({ data }) => {
        const row = { ...data };
        mock.orderItem._store.push(row);
        return row;
      }),
    };
    mock.orderItemModifier = {
      createMany: vi.fn(async ({ data }) => {
        orderItemModifierStore.push(...data);
        return undefined;
      }),
    };
    mock.cartItemModifier.deleteMany = vi.fn(async () => {
      // no-op for test
    });
    mock.cartItem.deleteMany = vi.fn(async () => {
      cartStore.length = 0;
    });
    return mock;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    cartStore.length = 0;
    __setTestPrisma(makePrismaMock() as any);
    registerSessionToken('s1', 'tok-1');
  });

  it('adds cart items via helper when token is valid', async () => {
    const result = await addCartItemForSession({
      sessionId: 's1',
      token: 'tok-1',
      menuItemId: 'm1',
      qty: 1,
      modifiers: [],
    });

    expect(result.cart).toHaveLength(1);
    expect(result.totals.total).toBe(500);
  });

  it('rejects cart add for invalid token', async () => {
    await expect(
      addCartItemForSession({
        sessionId: 's1',
        token: 'bad',
        menuItemId: 'm1',
        qty: 1,
        modifiers: [],
      })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('handles assistance request with valid token', async () => {
    const res = await handleAssistanceRequest({ sessionId: 's1', token: 'tok-1', message: 'help' });
    expect(res.payload).toMatchObject({ sessionId: 's1', message: 'help' });
  });

  it('submits order from cart and clears cart', async () => {
    // seed cart
    cartStore.push({
      id: 'c1',
      sessionId: 's1',
      menuItemId: 'm1',
      qty: 1,
      note: null,
      unitPrice: 500,
      itemName: 'Item 1',
      modifiers: [],
    });

    const res = await submitOrderForSession({
      sessionId: 's1',
      token: 'tok-1',
      clientOrderKey: 'order-key-1',
      io: null,
    });

    expect(res.order.status).toBe('NEW');
    expect(res.order.items).toHaveLength(1);
    expect(cartStore).toHaveLength(0);
  });
});

describe('idempotency helper', () => {
  it('replays cached response and skips duplicate handler calls', async () => {
    const { prisma } = makeIdempotencyPrisma();
    let calls = 0;

    const first = await withIdempotency(
      prisma as any,
      { scope: 'order.create', key: 'k1', requestHash: 'hash-1' },
      async () => {
        calls += 1;
        return { statusCode: 200, body: { orderId: 'order-1' } };
      }
    );
    const second = await withIdempotency(
      prisma as any,
      { scope: 'order.create', key: 'k1', requestHash: 'hash-1' },
      async () => {
        calls += 1;
        return { statusCode: 200, body: { orderId: 'order-2' } };
      }
    );

    expect(calls).toBe(1);
    expect(second.replay).toBe(true);
    expect(second.body).toEqual(first.body);
  });

  it('rejects mismatched payload for the same idempotency key', async () => {
    const { prisma } = makeIdempotencyPrisma();
    await withIdempotency(
      prisma as any,
      { scope: 'order.create', key: 'k2', requestHash: 'hash-1' },
      async () => ({ statusCode: 200, body: { ok: true } })
    );

    await expect(
      withIdempotency(
        prisma as any,
        { scope: 'order.create', key: 'k2', requestHash: 'hash-2' },
        async () => ({ statusCode: 200, body: { ok: true } })
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('cart editing helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('updates quantity and removes items safely', async () => {
    const now = new Date();
    const cart: any[] = [
      { id: 'c1', sessionId: 's1', menuItemId: 'm1', qty: 1, unitPrice: 500, itemName: 'Item 1', modifiers: [], createdAt: now },
    ];
    const session = {
      id: 's1',
      venueId: 'v1',
      tableId: 't1',
      status: TableSessionStatusEnum.enum.OPEN,
      peopleCount: 1,
      openedAt: now,
      lastActiveAt: now,
    };
    registerSessionToken('s1', 'tok');
    __setTestPrisma({
      tableSession: {
        findUnique: async ({ where }: any) => (where.id === 's1' ? session : null),
        update: async () => session,
      },
      cartItem: {
        findUnique: async ({ where }: any) => cart.find((c) => c.id === where.id) ?? null,
        update: async ({ where, data }: any) => {
          const row = cart.find((c) => c.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        },
        delete: async ({ where }: any) => {
          const idx = cart.findIndex((c) => c.id === where.id);
          if (idx >= 0) cart.splice(idx, 1);
        },
        deleteMany: async ({ where }: any) => {
          const before = cart.length;
          for (let i = cart.length - 1; i >= 0; i -= 1) {
            if (cart[i].id === where.id && cart[i].sessionId === where.sessionId) {
              cart.splice(i, 1);
            }
          }
          return { count: before - cart.length };
        },
        findMany: async ({ where }: any) =>
          cart
            .filter((c) => c.sessionId === where.sessionId)
            .map((c) => ({ ...c, modifiers: c.modifiers })),
      },
      cartItemModifier: {
        deleteMany: async () => ({}),
      },
    } as any);

    const updated = await updateCartItemQtyForSession({ sessionId: 's1', token: 'tok', cartItemId: 'c1', qty: 2 });
    expect(updated.cart[0].qty).toBe(2);
    expect(updated.totals.total).toBe(1000);

    const removed = await removeCartItemForSession({ sessionId: 's1', token: 'tok', cartItemId: 'c1' });
    expect(removed.cart).toHaveLength(0);
    expect(removed.totals.total).toBe(0);
  });
});

describe('served orders remain in session state until paid', () => {
  it('keeps served orders and outstanding until paid', async () => {
    const now = new Date();
    __setTestPrisma({
      tableSession: {
        findUnique: async () => ({
          id: 's1',
          venueId: 'v1',
          tableId: 't1',
          status: TableSessionStatusEnum.enum.OPEN,
          peopleCount: 2,
          openedAt: now,
          lastActiveAt: now,
          table: { code: 'T1' },
          cartItems: [],
          orders: [
            {
              id: 'o1',
              venueId: 'v1',
              sessionId: 's1',
              tableId: 't1',
              status: OrderStatusEnum.enum.SERVED,
              number: 1,
              comment: null,
              acceptedAt: null,
              readyAt: null,
              servedAt: now,
              createdAt: now,
              updatedAt: now,
              items: [
                {
                  id: 'oi1',
                  orderId: 'o1',
                  menuItemId: 'm1',
                  qty: 1,
                  unitPrice: 1200,
                  itemName: 'Item 1',
                  note: null,
                  modifiers: [],
                },
              ],
            },
          ],
          payments: [],
        }),
      },
      paymentIntent: {
        findMany: async () => [],
      },
      menu: {
        findUnique: async () => ({ version: 1 }),
      },
    } as any);

    const state = await __testGetSessionState('s1');
    expect(state).not.toBeNull();
    if (!state) return;
    expect(state.ordersActive).toHaveLength(1);
    expect(state.ordersActive[0].status).toBe(OrderStatusEnum.enum.SERVED);
    expect(state.outstanding.remaining).toBe(1200);
  });
});

describe.skip('payment quotes and modes', () => {
  const setupPrisma = (orders: any[], payments: any[] = [], currency = 'KGS') => {
    __setTestPrisma({
      tableSession: {
        findUnique: async () => ({
          id: 's1',
          venueId: 'v1',
          tableId: 't1',
          status: TableSessionStatusEnum.enum.OPEN,
          peopleCount: 2,
          openedAt: nowIso(),
          lastActiveAt: nowIso(),
          table: { code: 'T1' },
          venue: { currency },
          cartItems: [],
          orders,
          payments,
        }),
      },
      paymentIntent: {
        findMany: async () => payments.filter((p) => p.status === PaymentStatusEnum.enum.PAID),
        create: async ({ data }: any) => {
          const row = { ...data };
          payments.push(row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = payments.find((p) => p.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        },
      },
      order: {
        findMany: async () => orders,
      },
      menu: {
        findUnique: async () => ({ version: 1 }),
      },
    } as any);
  };

  const makeOrderRow = (id: string, amounts: number[]) => ({
    id,
    venueId: 'v1',
    sessionId: 's1',
    tableId: 't1',
    status: OrderStatusEnum.enum.NEW,
    number: 1,
    comment: null,
    acceptedAt: null,
    readyAt: null,
    servedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: amounts.map((amt, idx) => ({
      id: `${id}-item-${idx}`,
      orderId: id,
      menuItemId: `m-${idx}`,
      qty: 1,
      note: null,
      unitPrice: amt,
      itemName: `Item ${idx}`,
      modifiers: [],
    })),
  });

  it('quotes full outstanding and reduces remaining with payment record', async () => {
    const orders = [makeOrderRow('o1', [1000])];
    const payments: any[] = [];
    setupPrisma(orders, payments);
    registerSessionToken('s1', 'tok');
    const { quote } = await createPaymentQuote('s1', { mode: 'FULL', stateVersion: 1 } as any);
    expect(quote.amount).toBe(1000);
    payments.push({
      id: 'pay-1',
      venueId: 'v1',
      sessionId: 's1',
      amount: quote.amount,
      status: PaymentStatusEnum.enum.PAID,
      payload: { baseAmount: quote.amount },
      provider: 'mock',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const state = await __testGetSessionState('s1');
    expect(state?.outstanding.remaining).toBe(0);
  });

  it('quotes even split with rounding', async () => {
    const orders = [makeOrderRow('o1', [1001])];
    const payments: any[] = [];
    setupPrisma(orders, payments);
    registerSessionToken('s1', 'tok');
    const { quote } = await createPaymentQuote('s1', { mode: 'EVEN', stateVersion: 1 } as any);
    expect(quote.amount).toBe(501);
    payments.push({
      id: 'pay-1',
      venueId: 'v1',
      sessionId: 's1',
      amount: quote.amount,
      status: PaymentStatusEnum.enum.PAID,
      payload: { baseAmount: quote.amount },
      provider: 'mock',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const state = await __testGetSessionState('s1');
    expect(state?.outstanding.remaining).toBe(500);
  });

  it('quotes selected items using order item ids', async () => {
    const orders = [makeOrderRow('o1', [300, 700])];
    const payments: any[] = [];
    setupPrisma(orders, payments);
    registerSessionToken('s1', 'tok');
    const itemId = orders[0].items[0].id;
    const { quote } = await createPaymentQuote('s1', { mode: 'SELECTED', stateVersion: 1 } as any);
    expect(quote.amount).toBe(300);
    payments.push({
      id: 'pay-1',
      venueId: 'v1',
      sessionId: 's1',
      amount: quote.amount,
      status: PaymentStatusEnum.enum.PAID,
      payload: { baseAmount: quote.amount },
      provider: 'mock',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const state = await __testGetSessionState('s1');
    expect(state?.outstanding.remaining).toBe(700);
  });
});

describe('pagination and filters', () => {
  it('parses and clamps pagination and builds page info', () => {
    const params = parsePageParams({ page: '2', pageSize: '200' }, 20, 100);
    expect(params.page).toBe(2);
    expect(params.pageSize).toBe(100);
    expect(params.skip).toBe(100);
    expect(params.take).toBe(100);
    expect(buildPageInfo(2, 100, 450).pageCount).toBe(5);
    expect(() => parsePageParams({ page: '0' })).toThrow();
  });

  it('builds table filters with status and search', () => {
    const where = buildTableWhere('v1', { status: 'active', search: 'A' } as any);
    expect(where).toMatchObject({
      venueId: 'v1',
      isActive: true,
      OR: [
        { name: { contains: 'A', mode: 'insensitive' } },
        { code: { contains: 'A', mode: 'insensitive' } },
      ],
    });
  });

  it('builds staff filters with role, status and search', () => {
    const where = buildStaffWhere(undefined, { role: UserRoleEnum.enum.WAITER, status: 'inactive', search: 'alice' } as any);
    expect(where).toMatchObject({
      role: UserRoleEnum.enum.WAITER,
      isActive: false,
      OR: [
        { name: { contains: 'alice', mode: 'insensitive' } },
        { email: { contains: 'alice', mode: 'insensitive' } },
      ],
    });
  });

  it('builds order filters with status/date/search', () => {
    const where = buildOrdersWhere('v1', { status: 'READY,NEW', from: '2024-01-01', to: '2024-01-31', search: '12' } as any);
    expect(where).toMatchObject({
      venueId: 'v1',
      status: { in: ['READY', 'NEW'] },
      createdAt: { gte: new Date('2024-01-01'), lte: new Date('2024-01-31') },
    });
    expect(where.OR?.length).toBeGreaterThan(0);
  });
});
