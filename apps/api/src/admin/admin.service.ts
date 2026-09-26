import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { resources, resourceSchema } from './admin.schemas';
import { emitEvent } from '../integrations/autos/orders.service';
const ajv = new Ajv({ strict: false, allErrors: true, multipleOfPrecision: 8 });
addFormats(ajv);
const output = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_match, letter: string) =>
        letter.toUpperCase(),
      ),
      key === 'price_per_day' && typeof value === 'string'
        ? Number(value)
        : value,
    ]),
  );
@Injectable()
export class AdminService {
  constructor(private readonly db: DataSource) {}
  private resource(name: string) {
    const r = resources[name];
    if (!r) throw new NotFoundException('Recurso no encontrado.');
    return r;
  }
  async list(
    name: string,
    query: Record<string, string>,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const r = this.resource(name),
      page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new BadRequestException('Paginación inválida.');
    const allowedSort: Record<string, string> = {
      name: 'name',
      createdAt: 'created_at',
      ...(name === 'vehicles'
        ? { pricePerDay: 'price_per_day', year: 'year' }
        : {}),
    };
    const sort = allowedSort[query.sort ?? 'createdAt'];
    if (!sort) throw new BadRequestException('Ordenamiento inválido.');
    const dir = query.order ?? 'asc';
    if (!['asc', 'desc'].includes(dir))
      throw new BadRequestException('Orden inválido.');
    const values: unknown[] = [],
      conditions: string[] = [];
    for (const key of [
      'active',
      ...(name === 'vehicles'
        ? [
            'status',
            'brandId',
            'categoryId',
            'locationId',
            'transmission',
            'fuelType',
          ]
        : []),
    ]) {
      if (query[key] !== undefined) {
        const field = r.fields[key];
        if (!field) continue;
        if (key === 'active' && !['true', 'false'].includes(query[key]))
          throw new BadRequestException('active inválido.');
        values.push(query[key]);
        conditions.push(field.column + '::text=$' + values.length);
      }
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const [count] = await this.db.query<Array<{ n: string }>>(
      'SELECT count(*) AS n FROM ' + r.table + where,
      values,
    );
    const rows = await this.db.query<Record<string, unknown>[]>(
      'SELECT * FROM ' +
        r.table +
        where +
        ' ORDER BY ' +
        sort +
        ' ' +
        dir +
        ',id LIMIT $' +
        (values.length + 1) +
        ' OFFSET $' +
        (values.length + 2),
      [...values, limit, (page - 1) * limit],
    );
    return { data: rows.map(output), total: Number(count.n), page, limit };
  }
  async get(name: string, id: string): Promise<Record<string, unknown>> {
    const r = this.resource(name),
      [row] = await this.db.query<Record<string, unknown>[]>(
        'SELECT * FROM ' + r.table + ' WHERE id::text=$1',
        [id],
      );
    if (!row) throw new NotFoundException();
    return output(row);
  }
  async write(
    name: string,
    body: unknown,
    id?: string,
  ): Promise<Record<string, unknown>> {
    const r = this.resource(name),
      validate = ajv.compile(resourceSchema(name, id !== undefined));
    if (!validate(body))
      throw new BadRequestException(
        validate.errors?.map((e) => e.instancePath + ' ' + e.message),
      );
    const input = body as Record<string, unknown>,
      fields = Object.keys(input),
      values = fields.map((k) => input[k]),
      columns = fields.map((k) => r.fields[k].column);
    try {
      return await this.db.transaction(async (m) => {
        let rows: Record<string, unknown>[];
        if (id !== undefined) {
          const [exists] = await m.query<Array<{ id: string }>>(
            'SELECT id FROM ' + r.table + ' WHERE id::text=$1 FOR UPDATE',
            [id],
          );
          if (!exists) throw new NotFoundException();
          if (!fields.length) return this.get(name, id);
          rows = await m.query<Record<string, unknown>[]>(
            'WITH changed AS (UPDATE ' +
              r.table +
              ' SET ' +
              columns.map((c, i) => c + '=$' + (i + 1)).join(',') +
              ',updated_at=now() WHERE id::text=$' +
              (values.length + 1) +
              ' RETURNING *) SELECT * FROM changed',
            [...values, id],
          );
        } else {
          if (!r.integerId) {
            columns.unshift('id');
            values.unshift(randomUUID());
          }
          rows = await m.query<Record<string, unknown>[]>(
            'INSERT INTO ' +
              r.table +
              ' (' +
              columns.join(',') +
              ') VALUES(' +
              values.map((_v, i) => '$' + (i + 1)).join(',') +
              ') RETURNING *',
            values,
          );
        }
        if (name === 'depots')
          await emitEvent(m, null, 'DEPOT_UPDATE', String(rows[0].id), {
            depot_id: rows[0].id,
          });
        return output(rows[0]);
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'driverError' in error
          ? (error.driverError as { code?: string }).code
          : undefined;
      if (code && ['23503', '23505', '23514', '22003'].includes(code))
        throw new ConflictException(
          'Conflicto de integridad o valor fuera de rango.',
        );
      throw error;
    }
  }
  async deactivate(name: string, id: string): Promise<void> {
    await this.write(
      name,
      name === 'vehicles'
        ? { active: false, status: 'INACTIVE' }
        : { active: false },
      id,
    );
  }
  async orders(
    query: Record<string, string>,
  ): Promise<Record<string, unknown>[]> {
    const limit = Number(query.limit ?? 20),
      page = Number(query.page ?? 1);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(page) ||
      page < 1
    )
      throw new BadRequestException();
    return (
      await this.db.query<Record<string, unknown>[]>(
        'SELECT id,vehicle_id,owner_id,status,total_amount,currency,created_at FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, (page - 1) * limit],
      )
    ).map(output);
  }
}
