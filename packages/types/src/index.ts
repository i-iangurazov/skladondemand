import { z } from 'zod';

export const JoinSessionDto = z.object({
  venueSlug: z.string().min(1),
  tableCode: z.string().min(1),
  deviceHash: z.string().min(6),
  peopleCount: z.number().int().positive().optional(),
});

export type JoinSessionDtoType = z.infer<typeof JoinSessionDto>;

export const JoinSessionSocketDto = JoinSessionDto.extend({
  sessionId: z.string(),
  token: z.string(),
});
export type JoinSessionSocket = z.infer<typeof JoinSessionSocketDto>;

export const UserRoleEnum = z.enum(['ADMIN', 'KITCHEN', 'WAITER', 'VENUE_ADMIN', 'PLATFORM_OWNER']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const TableSessionStatusEnum = z.enum(['OPEN', 'CHECKOUT', 'CLOSED']);
export type TableSessionStatus = z.infer<typeof TableSessionStatusEnum>;

export const OrderStatusEnum = z.enum(['NEW', 'ACCEPTED', 'IN_PROGRESS', 'READY', 'SERVED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const ORDER_TRANSITIONS: Record<UserRole, Array<{ from: OrderStatus; to: OrderStatus }>> = {
  ADMIN: [
    // full control, mirrors kitchen + waiter plus ability to cancel
    { from: 'NEW', to: 'ACCEPTED' },
    { from: 'ACCEPTED', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'READY' },
    { from: 'READY', to: 'SERVED' },
    { from: 'NEW', to: 'CANCELLED' },
    { from: 'ACCEPTED', to: 'CANCELLED' },
    { from: 'IN_PROGRESS', to: 'CANCELLED' },
    { from: 'READY', to: 'CANCELLED' },
  ],
  KITCHEN: [
    { from: 'NEW', to: 'ACCEPTED' },
    { from: 'ACCEPTED', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'READY' },
    { from: 'READY', to: 'CANCELLED' },
  ],
  WAITER: [{ from: 'READY', to: 'SERVED' }],
  VENUE_ADMIN: [
    { from: 'NEW', to: 'ACCEPTED' },
    { from: 'ACCEPTED', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'READY' },
    { from: 'READY', to: 'SERVED' },
    { from: 'NEW', to: 'CANCELLED' },
    { from: 'ACCEPTED', to: 'CANCELLED' },
    { from: 'IN_PROGRESS', to: 'CANCELLED' },
    { from: 'READY', to: 'CANCELLED' },
  ],
  PLATFORM_OWNER: [
    { from: 'NEW', to: 'ACCEPTED' },
    { from: 'ACCEPTED', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'READY' },
    { from: 'READY', to: 'SERVED' },
    { from: 'NEW', to: 'CANCELLED' },
    { from: 'ACCEPTED', to: 'CANCELLED' },
    { from: 'IN_PROGRESS', to: 'CANCELLED' },
    { from: 'READY', to: 'CANCELLED' },
  ],
};

export const isOrderTransitionAllowed = (role: UserRole, from: OrderStatus, to: OrderStatus) => {
  if (from === to) return true;
  return ORDER_TRANSITIONS[role]?.some((rule) => rule.from === from && rule.to === to) ?? false;
};

export const PaymentStatusEnum = z.enum(['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const PaymentIntentDto = z.object({
  id: z.string(),
  venueId: z.string(),
  sessionId: z.string(),
  orderId: z.string().optional(),
  splitPlanId: z.string().optional(),
  sharesPaid: z.number().int().nonnegative().optional(),
  amount: z.number().int().nonnegative(),
  status: PaymentStatusEnum,
  provider: z.string(),
  payload: z
    .object({
      mode: z.enum(['FULL', 'EVEN', 'SELECTED']).optional(),
      items: z.array(z.string()).optional(),
      splitCount: z.number().int().positive().optional(),
      splitPlanId: z.string().optional(),
      sharesPaid: z.number().int().nonnegative().optional(),
      baseAmount: z.number().int().nonnegative().optional(),
      tipPercent: z.number().int().nonnegative().optional(),
      tipAmount: z.number().int().nonnegative().optional(),
      paidByDeviceHash: z.string().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentIntent = z.infer<typeof PaymentIntentDto>;

export const PaymentCreateDto = z.object({
  sessionId: z.string(),
  quoteId: z.string(),
  // legacy fields (optional, ignored by new flow)
  orderId: z.string().optional(),
  mode: z.enum(['FULL', 'EVEN', 'SELECTED']).optional(),
  items: z.array(z.string()).optional(),
  splitCount: z.number().int().positive().optional(),
  amount: z.number().int().positive().optional(),
  tipPercent: z.number().int().nonnegative().optional(), // percent tip applied to base amount
  tipAmount: z.number().int().nonnegative().optional(), // explicit tip in cents
  paidByDeviceHash: z.string().optional(),
  idempotencyKey: z.string().optional(),
  token: z.string(),
});
export type PaymentCreate = z.infer<typeof PaymentCreateDto>;

export const PaymentCreateResponseDto = z.object({
  payment: PaymentIntentDto,
});
export type PaymentCreateResponse = z.infer<typeof PaymentCreateResponseDto>;

export const PaymentQuoteRequestDto = z.object({
  mode: z.enum(['FULL', 'EVEN', 'SELECTED']),
  stateVersion: z.number().int().nonnegative(),
  splitPlanId: z.string().optional(),
  sharesToPay: z.number().int().positive().optional(),
  selectedOrderItemIds: z.array(z.string()).optional(),
  tipCents: z.number().int().nonnegative().optional(),
  tipPercent: z.number().int().nonnegative().optional(),
  token: z.string().optional(),
});
export type PaymentQuoteRequest = z.infer<typeof PaymentQuoteRequestDto>;

export const PaymentQuoteResponseDto = z.object({
  quoteId: z.string(),
  sessionId: z.string(),
  amount: z.number().int().nonnegative(),
  currency: z.string(),
  mode: z.enum(['FULL', 'EVEN', 'SELECTED']),
  splitPlanId: z.string().optional(),
  sharesToPay: z.number().int().positive().optional(),
  selectedOrderItemIds: z.array(z.string()).optional(),
  breakdown: z.record(z.string(), z.unknown()).optional(),
  remainingBefore: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(),
  stateVersion: z.number().int().nonnegative(),
});
export type PaymentQuoteResponse = z.infer<typeof PaymentQuoteResponseDto>;

export const PaymentUpdatedEventDto = z.object({
  payment: PaymentIntentDto,
});
export type PaymentUpdatedEvent = z.infer<typeof PaymentUpdatedEventDto>;

export const ModifierSelectionDto = z.object({
  optionId: z.string().min(1),
  optionName: z.string().min(1),
  priceDelta: z.number().int(),
});
export type ModifierSelection = z.infer<typeof ModifierSelectionDto>;

export const CartItemDto = z.object({
  id: z.string(),
  sessionId: z.string(),
  menuItemId: z.string(),
  qty: z.number().int().positive(),
  note: z.string().optional(),
  addedByDeviceHash: z.string().optional(),
  unitPrice: z.number().int(),
  itemName: z.string(),
  modifiers: z.array(ModifierSelectionDto),
});
export type CartItem = z.infer<typeof CartItemDto>;

export const OrderItemModifierDto = ModifierSelectionDto.extend({
  orderItemId: z.string().optional(),
});
export type OrderItemModifier = z.infer<typeof OrderItemModifierDto>;

export const OrderItemDto = z.object({
  id: z.string(),
  orderId: z.string(),
  menuItemId: z.string(),
  qty: z.number().int().positive(),
  note: z.string().optional(),
  unitPrice: z.number().int(),
  itemName: z.string(),
  modifiers: z.array(OrderItemModifierDto),
  paidCents: z.number().int().nonnegative().default(0),
  remainingCents: z.number().int().nonnegative().default(0),
});
export type OrderItem = z.infer<typeof OrderItemDto>;

export const OrderDto = z.object({
  id: z.string(),
  venueId: z.string(),
  sessionId: z.string(),
  tableId: z.string(),
  status: OrderStatusEnum,
  number: z.number().int().positive(),
  comment: z.string().optional(),
  acceptedAt: z.string().datetime().optional(),
  readyAt: z.string().datetime().optional(),
  servedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(OrderItemDto),
});
export type Order = z.infer<typeof OrderDto>;

export const TableSessionDto = z.object({
  id: z.string(),
  venueId: z.string(),
  tableId: z.string(),
  status: TableSessionStatusEnum,
  peopleCount: z.number().int().positive().optional(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  lastActiveAt: z.string().datetime(),
  stateVersion: z.number().int().nonnegative().default(1),
});
export type TableSession = z.infer<typeof TableSessionDto>;

export const SessionStateDto = z.object({
  session: TableSessionDto,
  cart: z.array(CartItemDto),
  ordersActive: z.array(OrderDto),
  payments: z.array(PaymentIntentDto).default([]),
  menuVersion: z.string().optional(),
  stateVersion: z.number().int().nonnegative().default(1),
  outstanding: z.object({
    base: z.number().int().nonnegative(),
    paid: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  }),
});
export type SessionState = z.infer<typeof SessionStateDto>;

export const SessionStateWithTokenDto = SessionStateDto.extend({
  sessionId: z.string(),
  token: z.string(),
});
export type SessionStateWithToken = z.infer<typeof SessionStateWithTokenDto>;

export const CartTotalsDto = z.object({
  subtotal: z.number().int(),
  total: z.number().int(),
  itemCount: z.number().int(),
});
export type CartTotals = z.infer<typeof CartTotalsDto>;

export const PageInfoDto = z.object({
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative(),
});
export type PageInfo = z.infer<typeof PageInfoDto>;

// Socket: client -> server
export const CartAddItemDto = z.object({
  sessionId: z.string(),
  menuItemId: z.string(),
  qty: z.number().int().positive(),
  modifiers: z.array(ModifierSelectionDto).default([]),
  note: z.string().optional(),
  token: z.string(),
});
export type CartAddItem = z.infer<typeof CartAddItemDto>;

export const CartUpdateItemQtyDto = z.object({
  sessionId: z.string(),
  cartItemId: z.string(),
  qty: z.number().int().nonnegative(),
  token: z.string(),
});
export type CartUpdateItemQty = z.infer<typeof CartUpdateItemQtyDto>;

export const CartRemoveItemDto = z.object({
  sessionId: z.string(),
  cartItemId: z.string(),
  token: z.string(),
});
export type CartRemoveItem = z.infer<typeof CartRemoveItemDto>;

export const OrderSubmitDto = z.object({
  sessionId: z.string(),
  clientOrderKey: z.string().uuid(),
  comment: z.string().optional(),
  token: z.string(),
});
export type OrderSubmit = z.infer<typeof OrderSubmitDto>;

export const OrderMarkServedDto = z.object({
  orderId: z.string(),
});
export type OrderMarkServed = z.infer<typeof OrderMarkServedDto>;

export const GuestPingDto = z.object({
  sessionId: z.string(),
  deviceHash: z.string(),
  token: z.string(),
});
export type GuestPing = z.infer<typeof GuestPingDto>;

export const SessionLeaveDto = z.object({
  sessionId: z.string(),
  deviceHash: z.string().optional(),
  reason: z.string().optional(),
  token: z.string(),
});
export type SessionLeave = z.infer<typeof SessionLeaveDto>;

export const AssistanceRequestDto = z.object({
  sessionId: z.string(),
  deviceHash: z.string().optional(),
  message: z.string().optional(),
  token: z.string(),
});
export type AssistanceRequest = z.infer<typeof AssistanceRequestDto>;

export const WaiterSubscribeDto = z.object({
  venueId: z.string(),
  token: z.string(),
});
export type WaiterSubscribe = z.infer<typeof WaiterSubscribeDto>;

// Socket: server -> client
export const CartUpdatedEventDto = z.object({
  cart: z.array(CartItemDto),
  totals: CartTotalsDto,
});
export type CartUpdatedEvent = z.infer<typeof CartUpdatedEventDto>;

export const SessionStateEventDto = SessionStateDto;
export type SessionStateEvent = z.infer<typeof SessionStateEventDto>;

export const OrderEventDto = z.object({
  order: OrderDto,
});
export type OrderEvent = z.infer<typeof OrderEventDto>;

export const MenuUpdatedEventDto = z.object({
  version: z.string(),
});
export type MenuUpdatedEvent = z.infer<typeof MenuUpdatedEventDto>;

export const MenuChangeEventDto = z.object({
  id: z.string(),
  menuId: z.string(),
  venueId: z.string(),
  type: z.string(),
  payload: z.unknown().optional(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
});
export type MenuChangeEvent = z.infer<typeof MenuChangeEventDto>;

export const MenuChangeEventsResponseDto = z.object({
  events: z.array(MenuChangeEventDto),
  latestVersion: z.number().int(),
});
export type MenuChangeEventsResponse = z.infer<typeof MenuChangeEventsResponseDto>;

export const ErrorEventDto = z.object({
  code: z.string(),
  message: z.string(),
});
export type ErrorEvent = z.infer<typeof ErrorEventDto>;

// REST: public
export const MenuModifierOptionDto = z.object({
  id: z.string(),
  name: z.string(),
  priceDelta: z.number().int(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type MenuModifierOption = z.infer<typeof MenuModifierOptionDto>;

export const MenuModifierGroupDto = z.object({
  id: z.string(),
  name: z.string(),
  isRequired: z.boolean().default(false),
  minSelect: z.number().int().default(0),
  maxSelect: z.number().int().default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(MenuModifierOptionDto),
});
export type MenuModifierGroup = z.infer<typeof MenuModifierGroupDto>;

export const MenuItemDto = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  accentColor: z.string().optional(),
  price: z.number().int(),
  isActive: z.boolean().default(true),
  isInStock: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  modifiers: z.array(MenuModifierGroupDto),
});
export type MenuItem = z.infer<typeof MenuItemDto>;

export const MenuCategoryDto = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  sortOrder: z.number().int().default(0),
  items: z.array(MenuItemDto),
});
export type MenuCategory = z.infer<typeof MenuCategoryDto>;

export const PublicMenuResponseDto = z.object({
  venue: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    currency: z.string(),
    timezone: z.string(),
  }),
  categories: z.array(MenuCategoryDto),
});
export type PublicMenuResponse = z.infer<typeof PublicMenuResponseDto>;

export const PublicSessionStateResponseDto = SessionStateDto;
export type PublicSessionStateResponse = z.infer<typeof PublicSessionStateResponseDto>;

export const JoinSessionResponseDto = SessionStateWithTokenDto;
export type JoinSessionResponse = z.infer<typeof JoinSessionResponseDto>;

// REST: staff
export const AuthLoginDto = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(5).optional(),
    password: z.string().min(6),
    role: UserRoleEnum.optional(),
  })
  .refine((data) => data.email || data.phone, { message: 'email or phone required' });
export type AuthLogin = z.infer<typeof AuthLoginDto>;

export const StaffUserDto = z.object({
  id: z.string(),
  venueId: z.string(),
  role: UserRoleEnum,
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});
export type StaffUser = z.infer<typeof StaffUserDto>;

export const AuthLoginResponseDto = z.object({
  accessToken: z.string(),
  user: StaffUserDto,
});
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseDto>;

export const AuthRefreshResponseDto = z.object({
  accessToken: z.string(),
  user: StaffUserDto,
});
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseDto>;

export const StaffUsersResponseDto = z.object({
  users: z.array(StaffUserDto),
  pageInfo: PageInfoDto,
});
export type StaffUsersResponse = z.infer<typeof StaffUsersResponseDto>;

export const StaffOrdersQueryDto = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});
export type StaffOrdersQuery = z.infer<typeof StaffOrdersQueryDto>;

export const StaffOrdersResponseDto = z.object({
  orders: z.array(OrderDto),
  pageInfo: PageInfoDto,
});
export type StaffOrdersResponse = z.infer<typeof StaffOrdersResponseDto>;

export const StaffOrderStatusPatchDto = z.object({
  status: OrderStatusEnum,
});
export type StaffOrderStatusPatch = z.infer<typeof StaffOrderStatusPatchDto>;

// Platform owner auth and resources
export const PlatformUserDto = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: UserRoleEnum,
  venueId: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type PlatformUser = z.infer<typeof PlatformUserDto>;

export const PlatformAuthLoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type PlatformAuthLogin = z.infer<typeof PlatformAuthLoginDto>;

export const PlatformAuthLoginResponseDto = z.object({
  accessToken: z.string(),
  user: PlatformUserDto,
});
export type PlatformAuthLoginResponse = z.infer<typeof PlatformAuthLoginResponseDto>;

export const OwnerVenueDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  address: z.string().optional(),
  currency: z.string(),
  timezone: z.string(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OwnerVenue = z.infer<typeof OwnerVenueDto>;

export const OwnerVenueCreateDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  address: z.string().optional(),
  currency: z.string().default('KGS'),
  timezone: z.string().default('Asia/Bishkek'),
});
export type OwnerVenueCreate = z.infer<typeof OwnerVenueCreateDto>;

export const OwnerVenueUpdateDto = OwnerVenueCreateDto.partial().extend({
  isActive: z.boolean().optional(),
});
export type OwnerVenueUpdate = z.infer<typeof OwnerVenueUpdateDto>;

export const OwnerTableDto = z.object({
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
  code: z.string(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OwnerTable = z.infer<typeof OwnerTableDto>;

export const OwnerTableCreateDto = z.object({
  name: z.string(),
  code: z.string(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});
export type OwnerTableCreate = z.infer<typeof OwnerTableCreateDto>;

export const OwnerTableUpdateDto = OwnerTableCreateDto.partial();
export type OwnerTableUpdate = z.infer<typeof OwnerTableUpdateDto>;

export const OwnerBulkTableCreateDto = z.object({
  prefix: z.string().default('T'),
  count: z.number().int().positive().max(200),
  capacity: z.number().int().positive().optional(),
});
export type OwnerBulkTableCreate = z.infer<typeof OwnerBulkTableCreateDto>;

export const TablesListResponseDto = z.object({
  tables: z.array(OwnerTableDto),
  pageInfo: PageInfoDto,
});
export type TablesListResponse = z.infer<typeof TablesListResponseDto>;

export const OwnerStaffCreateDto = z.object({
  venueId: z.string(),
  role: UserRoleEnum,
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  isActive: z.boolean().optional(),
});
export type OwnerStaffCreate = z.infer<typeof OwnerStaffCreateDto>;

export const OwnerStaffUpdateDto = OwnerStaffCreateDto.partial();
export type OwnerStaffUpdate = z.infer<typeof OwnerStaffUpdateDto>;

export const OwnerStatsDto = z.object({
  ordersByStatus: z.record(OrderStatusEnum, z.number().int().nonnegative()).default({} as any),
  ordersLast7d: z.array(z.object({ date: z.string(), count: z.number().int().nonnegative() })),
  ordersLast30d: z.array(z.object({ date: z.string(), count: z.number().int().nonnegative() })),
  revenue: z.number().int().nonnegative(),
  topItems: z.array(z.object({ itemName: z.string(), qty: z.number().int().nonnegative(), revenue: z.number().int().nonnegative() })),
});
export type OwnerStats = z.infer<typeof OwnerStatsDto>;

export const OwnerMenuVersionDto = z.object({ version: z.string() });
export type OwnerMenuVersion = z.infer<typeof OwnerMenuVersionDto>;

// REST: admin
export const StaffCreateDto = z
  .object({
    venueId: z.string(),
    role: UserRoleEnum,
    name: z.string(),
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.email || data.phone, { message: 'email or phone required' });
export type StaffCreate = z.infer<typeof StaffCreateDto>;

export const StaffUpdateDto = StaffCreateDto.partial();
export type StaffUpdate = z.infer<typeof StaffUpdateDto>;

export const AdminTableDto = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  isActive: z.boolean().default(true),
});
export type AdminTable = z.infer<typeof AdminTableDto>;

export const AdminTableCreateDto = z.object({
  name: z.string(),
  code: z.string(),
  isActive: z.boolean().default(true),
});
export type AdminTableCreate = z.infer<typeof AdminTableCreateDto>;

export const AdminMenuItemCreateDto = z.object({
  categoryId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().int(),
  imageUrl: z.string().url().optional(),
  accentColor: z.string().optional(),
  isActive: z.boolean().default(true),
  isInStock: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
  modifiers: z.array(MenuModifierGroupDto).default([]),
});
export type AdminMenuItemCreate = z.infer<typeof AdminMenuItemCreateDto>;

export const AdminMenuItemUpdateDto = AdminMenuItemCreateDto.partial();
export type AdminMenuItemUpdate = z.infer<typeof AdminMenuItemUpdateDto>;

export const AdminTableUpdateDto = AdminTableCreateDto.partial();
export type AdminTableUpdate = z.infer<typeof AdminTableUpdateDto>;
