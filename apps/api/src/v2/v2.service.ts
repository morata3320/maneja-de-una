import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { compare, hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { requiredSecret } from '../security/token-verifier';
import type { PublicUser } from '../auth/auth.service';
import type {
  LoginV2Dto,
  PaymentDto,
  RegisterV2Dto,
  ReservationDto,
  ReservationPatchDto,
  SelfUpdateDto,
  UserCreateDto,
  UserUpdateDto,
  VehicleDto,
  VehiclePatchDto,
} from './dto';
import { cardBrand, luhnValid } from './validation';

type Row = Record<string, unknown>;
const camel = (key: string) =>
  key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const expose = (row: Row): Row =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([k]) => k !== 'password_hash')
      .map(([k, v]) => [
        camel(k),
        ['price_per_day', 'total_amount', 'amount', 'score'].includes(k) &&
        typeof v === 'string'
          ? Number(v)
          : v,
      ]),
  );
const pagination = (q: Record<string, unknown>) => {
  const page = Number(q.page ?? 1),
    limit = Number(q.limit ?? 20);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new BadRequestException('Paginacion invalida');
  return { page, limit, offset: (page - 1) * limit };
};
const userView = (u: Row) => expose(u);

@Injectable()
export class V2Service {
  private readonly jwtKey = new TextEncoder().encode(
    requiredSecret('INTERNAL_JWT_SECRET'),
  );
  constructor(private readonly db: DataSource) {}
  private readonly catalogs: Record<
    string,
    {
      table: string;
      id: string;
      integer?: boolean;
      fields: Record<string, string>;
    }
  > = {
    brands: {
      table: 'brands',
      id: 'id',
      fields: { name: 'name', active: 'active' },
    },
    'vehicle-models': {
      table: 'vehicle_models',
      id: 'id',
      fields: { brandId: 'brand_id', name: 'name', active: 'active' },
    },
    categories: {
      table: 'categories',
      id: 'id',
      fields: { name: 'name', description: 'description', active: 'active' },
    },
    locations: {
      table: 'locations',
      id: 'id',
      fields: {
        name: 'name',
        city: 'city',
        province: 'province',
        active: 'active',
      },
    },
    suppliers: {
      table: 'suppliers',
      id: 'id',
      integer: true,
      fields: { name: 'name', active: 'active' },
    },
    depots: {
      table: 'depots',
      id: 'id',
      integer: true,
      fields: {
        supplierId: 'supplier_id',
        locationId: 'location_id',
        name: 'name',
        airport: 'airport',
        cityId: 'city_id',
        latitude: 'latitude',
        longitude: 'longitude',
        active: 'active',
      },
    },
    'depot-scores': {
      table: 'depot_scores',
      id: 'depot_id',
      integer: true,
      fields: { depotId: 'depot_id', score: 'score' },
    },
  };

  async catalogList(resource: string, query: Record<string, unknown>) {
    const c = this.catalogs[resource];
    if (!c) throw new NotFoundException();
    const { page, limit, offset } = pagination(query);
    const search = query.search && c.fields.name ? ' WHERE name ILIKE $3' : '';
    const args = search
      ? [limit, offset, `%${String(query.search)}%`]
      : [limit, offset];
    const rows = await this.db.query<Row[]>(
      `SELECT * FROM ${c.table}${search} ORDER BY ${c.id} LIMIT $1 OFFSET $2`,
      args,
    );
    const [{ count }] = await this.db.query<Array<{ count: string }>>(
      `SELECT count(*) count FROM ${c.table}${search}`,
      search ? [`%${String(query.search)}%`] : [],
    );
    return { data: rows.map(expose), total: Number(count), page, limit };
  }
  async catalogGet(resource: string, id: string) {
    const c = this.catalogs[resource];
    if (!c) throw new NotFoundException();
    const [r] = await this.db.query<Row[]>(
      `SELECT * FROM ${c.table} WHERE ${c.id}::text=$1`,
      [id],
    );
    if (!r) throw new NotFoundException();
    return expose(r);
  }
  async catalogWrite(
    resource: string,
    body: Record<string, unknown>,
    id?: string,
  ) {
    const c = this.catalogs[resource];
    if (!c) throw new NotFoundException();
    const entries = Object.entries(body);
    if (!entries.length) throw new BadRequestException('Body vacio');
    for (const [k] of entries)
      if (!c.fields[k])
        throw new BadRequestException(`Campo no permitido: ${k}`);
    const vals = entries.map(([, v]) => v),
      cols = entries.map(([k]) => c.fields[k]);
    try {
      if (id) {
        const [r] = await this.db.query<Row[]>(
          `UPDATE ${c.table} SET ${cols.map((x, i) => `${x}=$${i + 1}`).join(',')}${resource === 'depot-scores' ? '' : ',updated_at=now()'} WHERE ${c.id}::text=$${vals.length + 1} RETURNING *`,
          [...vals, id],
        );
        if (!r) throw new NotFoundException();
        return expose(r);
      }
      if (resource === 'depot-scores') {
        const [r] = await this.db.query<Row[]>(
          `INSERT INTO depot_scores(${cols.join(',')}) VALUES(${vals.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
          vals,
        );
        return expose(r);
      }
      const allCols = c.integer ? cols : ['id', ...cols],
        allVals = c.integer ? vals : [randomUUID(), ...vals];
      const [r] = await this.db.query<Row[]>(
        `INSERT INTO ${c.table}(${allCols.join(',')}) VALUES(${allVals.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
        allVals,
      );
      return expose(r);
    } catch (e) {
      if ((e as { code?: string }).code?.startsWith('23'))
        throw new ConflictException('Conflicto de integridad');
      throw e;
    }
  }
  async catalogDelete(resource: string, id: string) {
    const c = this.catalogs[resource];
    if (!c) throw new NotFoundException();
    const sql = c.fields.active
      ? `UPDATE ${c.table} SET active=false,updated_at=now() WHERE ${c.id}::text=$1 RETURNING ${c.id}`
      : `DELETE FROM ${c.table} WHERE ${c.id}::text=$1 RETURNING ${c.id}`;
    const rows = await this.db.query<Row[]>(sql, [id]);
    if (!rows.length) throw new NotFoundException();
  }

  async register(body: RegisterV2Dto) {
    if (Buffer.byteLength(body.password, 'utf8') > 72)
      throw new BadRequestException('Contrasena excede 72 bytes');
    const email = body.email.toLowerCase(),
      id = randomUUID();
    const rows = await this.db.query<Row[]>(
      `INSERT INTO users(id,name,first_name,last_name,email,password_hash,cedula,phone,role,status,active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'USER','ACTIVE',true) ON CONFLICT DO NOTHING RETURNING *`,
      [
        id,
        `${body.firstName} ${body.lastName}`,
        body.firstName,
        body.lastName,
        email,
        await hash(body.password, 12),
        body.cedula,
        body.phone,
      ],
    );
    if (!rows.length)
      throw new ConflictException('Email o cedula ya registrado');
    return userView(rows[0]);
  }
  async login(body: LoginV2Dto) {
    const [user] = await this.db.query<Row[]>(
      'SELECT * FROM users WHERE email=$1',
      [body.email.toLowerCase()],
    );
    const storedHash = typeof user?.password_hash === 'string'
      ? user.password_hash
      : await hash('unusable-dummy-password', 12);
    const valid = await compare(body.password, storedHash);
    if (!user || !valid || user.status !== 'ACTIVE' || !user.active)
      throw new (await import('@nestjs/common')).UnauthorizedException(
        'Credenciales invalidas',
      );
    const accessToken = await new SignJWT({
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime(process.env.JWT_EXPIRES_IN ?? '1h')
      .setIssuer('urn:maneja:internal')
      .setAudience('maneja-web')
      .sign(this.jwtKey);
    return { accessToken, user: userView(user) };
  }

  async users(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query),
      values: unknown[] = [],
      where: string[] = [];
    if (typeof query.search === 'string') {
      values.push('%' + query.search + '%');
      where.push(
        `(first_name ILIKE $${values.length} OR last_name ILIKE $${values.length} OR email ILIKE $${values.length})`,
      );
    }
    for (const k of ['status', 'role'])
      if (query[k]) {
        values.push(query[k]);
        where.push(`${k}=$${values.length}`);
      }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const [{ count }] = await this.db.query<Array<{ count: string }>>(
      `SELECT count(*) count FROM users${clause}`,
      values,
    );
    const rows = await this.db.query<Row[]>(
      `SELECT * FROM users${clause} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    return {
      data: rows.map(userView),
      total: Number(count),
      page,
      limit,
      _links: { self: { href: `/api/v2/users?page=${page}&limit=${limit}` } },
    };
  }
  async user(id: string) {
    const [row] = await this.db.query<Row[]>(
      'SELECT * FROM users WHERE id::text=$1',
      [id],
    );
    if (!row) throw new NotFoundException('Usuario no encontrado');
    return userView(row);
  }
  async createUser(body: UserCreateDto) {
    const result = await this.register(body);
    const role = body.role ?? 'USER',
      status = body.status ?? 'ACTIVE';
    const [row] = await this.db.query<Row[]>(
      'UPDATE users SET role=$1,status=$2,active=$3 WHERE id=$4 RETURNING *',
      [role, status, status === 'ACTIVE', result.id],
    );
    return userView(row);
  }
  async updateUser(
    id: string,
    body: UserUpdateDto | SelfUpdateDto,
    self = false,
  ) {
    const fields: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      cedula: 'cedula',
      phone: 'phone',
      email: 'email',
      role: 'role',
      status: 'status',
    };
    const entries = Object.entries(body).filter(
      ([k, v]) =>
        v !== undefined &&
        k !== 'password' &&
        (!self || !['role', 'status', 'email'].includes(k)),
    );
    if (!entries.length) return this.user(id);
    const values = entries.map(([, v]) => v);
    const sets = entries.map(([k], i) => `${fields[k]}=$${i + 1}`);
    if (entries.some(([k]) => ['firstName', 'lastName'].includes(k)))
      sets.push(`name=trim(first_name||' '||last_name)`);
    const [row] = await this.db.query<Row[]>(
      `UPDATE users SET ${sets.join(',')},updated_at=now() WHERE id::text=$${values.length + 1} RETURNING *`,
      [...values, id],
    );
    if (!row) throw new NotFoundException('Usuario no encontrado');
    return userView(row);
  }
  async setUserStatus(id: string, status: string) {
    const [row] = await this.db.query<Row[]>(
      'UPDATE users SET status=$1,active=$2,updated_at=now() WHERE id::text=$3 RETURNING *',
      [status, status === 'ACTIVE', id],
    );
    if (!row) throw new NotFoundException();
    return userView(row);
  }
  async deleteUser(id: string) {
    const result = await this.db.query('DELETE FROM users WHERE id::text=$1', [
      id,
    ]);
    if (!result[1]) throw new NotFoundException();
  }

  async vehicles(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query),
      values: unknown[] = [],
      where = ['v.active=true'];
    const exact: Record<string, string> = {
      brand: 'b.name',
      category: 'c.name',
      transmission: 'v.transmission',
      fuelType: 'v.fuel_type',
      location: 'l.name',
      supplier: 's.name',
      status: 'v.status',
    };
    for (const [key, col] of Object.entries(exact))
      if (query[key]) {
        values.push(query[key]);
        where.push(`${col}::text ILIKE $${values.length}`);
      }
    if (typeof query.search === 'string') {
      values.push('%' + query.search + '%');
      where.push(
        `(b.name ILIKE $${values.length} OR vm.name ILIKE $${values.length} OR v.description ILIKE $${values.length})`,
      );
    }
    if (query.minPrice) {
      values.push(Number(query.minPrice));
      where.push(`v.price_per_day >= $${values.length}`);
    }
    if (query.maxPrice) {
      values.push(Number(query.maxPrice));
      where.push(`v.price_per_day <= $${values.length}`);
    }
    const order =
      query.sort === 'price_asc'
        ? 'v.price_per_day ASC'
        : query.sort === 'price_desc'
          ? 'v.price_per_day DESC'
          : 'v.created_at DESC';
    const from = ` FROM vehicles v JOIN brands b ON b.id=v.brand_id JOIN vehicle_models vm ON vm.id=v.model_id JOIN categories c ON c.id=v.category_id JOIN locations l ON l.id=v.location_id JOIN suppliers s ON s.id=v.supplier_id WHERE ${where.join(' AND ')}`;
    const [{ count }] = await this.db.query<Array<{ count: string }>>(
      `SELECT count(*) count${from}`,
      values,
    );
    const rows = await this.db.query<Row[]>(
      `SELECT v.*,b.name brand,vm.name model,c.name category,l.name location,s.name supplier${from} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    return {
      data: rows.map(expose),
      total: Number(count),
      page,
      limit,
      _links: {
        self: { href: `/api/v2/vehicles?page=${page}&limit=${limit}` },
      },
    };
  }
  async vehicle(id: string) {
    const [row] = await this.db.query<Row[]>(
      `SELECT v.*,b.name brand,vm.name model,c.name category,l.name location,s.name supplier FROM vehicles v JOIN brands b ON b.id=v.brand_id JOIN vehicle_models vm ON vm.id=v.model_id JOIN categories c ON c.id=v.category_id JOIN locations l ON l.id=v.location_id JOIN suppliers s ON s.id=v.supplier_id WHERE v.id::text=$1`,
      [id],
    );
    if (!row) throw new NotFoundException('Vehiculo no encontrado');
    return {
      ...expose(row),
      _links: {
        self: { href: `/api/v2/vehicles/${id}` },
        update: { href: `/api/v2/vehicles/${id}`, method: 'PATCH' },
        delete: { href: `/api/v2/vehicles/${id}`, method: 'DELETE' },
        reserve: { href: '/api/v2/reservations', method: 'POST' },
      },
    };
  }
  async writeVehicle(body: VehicleDto | VehiclePatchDto, id?: string) {
    const map: Record<string, string> = {
      brandId: 'brand_id',
      modelId: 'model_id',
      categoryId: 'category_id',
      locationId: 'location_id',
      supplierId: 'supplier_id',
      depotId: 'depot_id',
      year: 'year',
      color: 'color',
      licensePlate: 'license_plate',
      transmission: 'transmission',
      fuelType: 'fuel_type',
      seats: 'seats',
      doors: 'doors',
      bagCapacity: 'bag_capacity',
      pricePerDay: 'price_per_day',
      mileage: 'mileage',
      description: 'description',
      status: 'status',
      active: 'active',
    };
    const entries = Object.entries(body).filter(([, v]) => v !== undefined),
      values = entries.map(([, v]) => v),
      cols = entries.map(([k]) => map[k]);
    try {
      if (id) {
        const [row] = await this.db.query<Row[]>(
          `UPDATE vehicles SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(',')},updated_at=now() WHERE id::text=$${values.length + 1} RETURNING *`,
          [...values, id],
        );
        if (!row) throw new NotFoundException();
        return this.vehicle(id);
      }
      const vehicleId = randomUUID();
      const rows = await this.db.query<Row[]>(
        `INSERT INTO vehicles(id,${cols.join(',')}) VALUES($1,${values.map((_, i) => `$${i + 2}`).join(',')}) RETURNING *`,
        [vehicleId, ...values],
      );
      return this.vehicle(String(rows[0].id));
    } catch (e) {
      if ((e as { code?: string }).code?.startsWith('23'))
        throw new ConflictException('Conflicto de integridad');
      throw e;
    }
  }
  async deleteVehicle(id: string) {
    const rows = await this.db.query<Row[]>(
      "UPDATE vehicles SET active=false,status='INACTIVE',updated_at=now() WHERE id::text=$1 RETURNING id",
      [id],
    );
    if (!rows.length) throw new NotFoundException();
  }

  async favorites(userId: string) {
    return (
      await this.db.query<Row[]>(
        `SELECT v.*,f.created_at favorited_at FROM favorites f JOIN vehicles v ON v.id=f.vehicle_id WHERE f.user_id=$1 ORDER BY f.created_at DESC`,
        [userId],
      )
    ).map(expose);
  }
  async addFavorite(userId: string, vehicleId: string) {
    if (
      !(
        await this.db.query<Row[]>(
          'SELECT id FROM vehicles WHERE id::text=$1',
          [vehicleId],
        )
      ).length
    )
      throw new NotFoundException('Vehiculo no encontrado');
    try {
      const [r] = await this.db.query<Row[]>(
        'INSERT INTO favorites(id,user_id,vehicle_id) VALUES($1,$2,$3) RETURNING *',
        [randomUUID(), userId, vehicleId],
      );
      return expose(r);
    } catch (e) {
      if ((e as { code?: string }).code === '23505')
        throw new ConflictException('Favorito ya agregado');
      throw e;
    }
  }
  async removeFavorite(userId: string, vehicleId: string) {
    const r = await this.db.query(
      'DELETE FROM favorites WHERE user_id=$1 AND vehicle_id=$2',
      [userId, vehicleId],
    );
    if (!r[1]) throw new NotFoundException();
  }

  async createReservation(userId: string, body: ReservationDto) {
    const start = new Date(body.startDate),
      end = new Date(body.endDate);
    if (
      !Number.isFinite(start.valueOf()) ||
      !Number.isFinite(end.valueOf()) ||
      start >= end ||
      start < new Date()
    )
      throw new BadRequestException('Fechas invalidas o pasadas');
    return this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        body.vehicleId,
      ]);
      const [v] = await m.query<Row[]>(
        "SELECT * FROM vehicles WHERE id=$1 AND active AND status<>'INACTIVE'",
        [body.vehicleId],
      );
      if (!v) throw new NotFoundException('Vehiculo no encontrado');
      const overlap = await m.query<Row[]>(
        `SELECT id FROM orders WHERE vehicle_id=$1 AND status IN ('PENDING','CONFIRMED') AND starts_at<$3 AND ends_at>$2 LIMIT 1`,
        [body.vehicleId, start, end],
      );
      if (overlap.length)
        throw new ConflictException('Vehiculo no disponible en esas fechas');
      const days = Math.ceil((end.valueOf() - start.valueOf()) / 86400000),
        total = Number(v.price_per_day) * days,
        id = randomUUID();
      const [r] = await m.query<Row[]>(
        `INSERT INTO orders(id,vehicle_id,owner_id,preview_id,locator,status,route,starts_at,ends_at,price_per_day,total_amount,currency,extras,vehicle_details,driver_details,payment_reference) VALUES($1,$2,$3,NULL,$4,'PENDING',$5,$6,$7,$8,$9,'USD',$10,$11,$12,NULL) RETURNING *`,
        [
          id,
          body.vehicleId,
          userId,
          `MDU-${randomBytes(4).toString('hex').toUpperCase()}`,
          { pickup: body.pickupLocation, dropoff: body.dropoffLocation },
          start,
          end,
          v.price_per_day,
          total,
          body.extras ?? [],
          v,
          body.driver ?? {},
        ],
      );
      return expose(r);
    });
  }
  async reservations(
    user: PublicUser,
    all: boolean,
    query: Record<string, unknown> = {},
  ) {
    const { page, limit, offset } = pagination(query),
      vals: unknown[] = [],
      where: string[] = [];
    if (!all || user.role !== 'ADMIN') {
      vals.push(user.id);
      where.push(`o.owner_id=$${vals.length}`);
    }
    for (const [k, c] of [
      ['status', 'o.status'],
      ['userId', 'o.owner_id'],
      ['vehicleId', 'o.vehicle_id'],
    ] as const)
      if (query[k] && user.role === 'ADMIN') {
        vals.push(query[k]);
        where.push(`${c}::text=$${vals.length}`);
      }
    if (typeof query.search === 'string' && query.search.trim()) {
      vals.push(`%${query.search.trim()}%`);
      where.push(
        `(o.id::text ILIKE $${vals.length} OR u.email ILIKE $${vals.length} OR concat(u.first_name,' ',u.last_name) ILIKE $${vals.length} OR concat(b.name,' ',vm.name) ILIKE $${vals.length})`,
      );
    }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const from = ` FROM orders o JOIN users u ON u.id=o.owner_id JOIN vehicles v ON v.id=o.vehicle_id JOIN brands b ON b.id=v.brand_id JOIN vehicle_models vm ON vm.id=v.model_id LEFT JOIN payments p ON p.order_id=o.id${clause}`;
    const [{ count }] = await this.db.query<Array<{ count: string }>>(
      `SELECT count(*) count${from}`,
      vals,
    );
    const rows = await this.db.query<Row[]>(
      `SELECT o.*,p.status payment_status,p.payment_reference,concat(u.first_name,' ',u.last_name) customer,u.email,concat(b.name,' ',vm.name) vehicle${from} ORDER BY o.created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, limit, offset],
    );
    return { data: rows.map(expose), total: Number(count), page, limit };
  }
  async reservation(user: PublicUser, id: string) {
    const [r] = await this.db.query<Row[]>(
      'SELECT o.*,p.status payment_status,p.payment_reference FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.id::text=$1',
      [id],
    );
    if (!r) throw new NotFoundException();
    if (user.role !== 'ADMIN' && r.owner_id !== user.id)
      throw new ForbiddenException();
    return expose(r);
  }
  async updateReservation(
    user: PublicUser,
    id: string,
    body: ReservationPatchDto,
  ) {
    await this.reservation(user, id);
    const entries = Object.entries(body);
    if (!entries.length) return this.reservation(user, id);
    const map: Record<string, string> = {
        startDate: 'starts_at',
        endDate: 'ends_at',
      },
      vals = entries.map(([, v]) => v);
    await this.db.query(
      `UPDATE orders SET ${entries.map(([k], i) => `${map[k]}=$${i + 1}`).join(',')},updated_at=now() WHERE id::text=$${vals.length + 1} AND status='PENDING'`,
      [...vals, id],
    );
    return this.reservation(user, id);
  }
  async cancelReservation(user: PublicUser, id: string) {
    await this.reservation(user, id);
    const rows = await this.db.query<Row[]>(
      `UPDATE orders SET status='CANCELLED',updated_at=now() WHERE id::text=$1 AND status IN ('PENDING','CONFIRMED') RETURNING *`,
      [id],
    );
    if (!rows.length) throw new ConflictException('Reserva no cancelable');
    return expose(rows[0]);
  }

  async simulatePayment(user: PublicUser, body: PaymentDto) {
    const number = body.cardNumber.replace(/\s/g, '');
    if (!luhnValid(number))
      throw new BadRequestException('Numero de tarjeta invalido');
    const brand = cardBrand(number),
      digits = brand === 'AMEX' ? 4 : 3;
    if (body.cvv.length !== digits)
      throw new BadRequestException('CVV invalido');
    const now = new Date(),
      year = body.expiryYear < 100 ? 2000 + body.expiryYear : body.expiryYear;
    if (
      year < now.getFullYear() ||
      (year === now.getFullYear() && body.expiryMonth < now.getMonth() + 1) ||
      year > now.getFullYear() + 20
    )
      throw new BadRequestException('Fecha de expiracion invalida');
    return this.db.transaction(async (m) => {
      const [order] = await m.query<Row[]>(
        'SELECT * FROM orders WHERE id=$1 FOR UPDATE',
        [body.reservationId],
      );
      if (!order) throw new NotFoundException('Reserva no encontrada');
      if (user.role !== 'ADMIN' && order.owner_id !== user.id)
        throw new ForbiddenException();
      const [dbUser] = await m.query<Row[]>(
        "SELECT id FROM users WHERE id=$1 AND active AND status='ACTIVE'",
        [user.id],
      );
      if (!dbUser) throw new ForbiddenException('Usuario inactivo');
      if (order.status !== 'PENDING')
        throw new ConflictException('Reserva no pagable');
      const reference = `PAY-MDU-${randomBytes(4).toString('hex').toUpperCase()}`;
      const [p] = await m.query<Row[]>(
        `INSERT INTO payments(id,order_id,user_id,amount,currency,status,method,card_brand,card_last4,payment_reference) VALUES($1,$2,$3,$4,$5,'APPROVED','CARD',$6,$7,$8) RETURNING *`,
        [
          randomUUID(),
          order.id,
          user.id,
          order.total_amount,
          order.currency,
          brand,
          number.slice(-4),
          reference,
        ],
      );
      await m.query(
        "UPDATE orders SET status='CONFIRMED',payment_reference=$1,updated_at=now() WHERE id=$2",
        [reference, order.id],
      );
      return {
        status: 'APPROVED',
        paymentReference: reference,
        amount: Number(p.amount),
        currency: p.currency,
        card: { brand, last4: number.slice(-4) },
      };
    });
  }
  async payments() {
    return (
      await this.db.query<Row[]>(
        `SELECT p.id,p.payment_reference,p.order_id reservation_id,p.user_id,p.amount,p.currency,p.status,p.method,p.card_brand brand,p.card_last4 last4,p.created_at,concat(u.first_name,' ',u.last_name) customer,u.email FROM payments p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC`,
      )
    ).map(expose);
  }
  async dashboard() {
    const [[v], [u], [o], [p]] = await Promise.all([
      this.db.query<Row[]>(
        `SELECT count(*) total,count(*) FILTER(WHERE status='AVAILABLE') available,count(*) FILTER(WHERE status IN ('RESERVED','RENTED')) reserved FROM vehicles WHERE active`,
      ),
      this.db.query<Row[]>('SELECT count(*) total FROM users'),
      this.db.query<Row[]>(
        `SELECT count(*) FILTER(WHERE status IN ('PENDING','CONFIRMED')) active,count(*) FILTER(WHERE status='CONFIRMED') confirmed,count(*) FILTER(WHERE status='CANCELLED') cancelled FROM orders`,
      ),
      this.db.query<Row[]>(
        `SELECT count(*) FILTER(WHERE status='APPROVED') approved,COALESCE(sum(amount) FILTER(WHERE status='APPROVED'),0) revenue FROM payments`,
      ),
    ]);
    return {
      totalVehicles: Number(v.total),
      availableVehicles: Number(v.available),
      reservedVehicles: Number(v.reserved),
      customers: Number(u.total),
      activeReservations: Number(o.active),
      confirmedReservations: Number(o.confirmed),
      cancelledReservations: Number(o.cancelled),
      approvedPayments: Number(p.approved),
      simulatedRevenue: Number(p.revenue),
    };
  }
}
