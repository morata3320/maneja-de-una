import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import type {
  CreateBookingClientDto,
  FindBookingClientDto,
} from './booking-clients.dto';

export type BookingClientRow = {
  id: string;
  name: string;
  email: string;
  identification: string;
  phone: string;
  license: string;
};

type DriverDetails = Record<string, unknown>;

@Injectable()
export class BookingClientsService {
  constructor(private readonly db: DataSource) {}

  async find(query: FindBookingClientDto) {
    const email = query.email?.trim().toLowerCase() ?? null;
    const identification = query.identificacion?.trim() ?? null;
    if (!email && !identification)
      throw new BadRequestException('email o identificacion es obligatorio.');
    const [client] = await this.db.query<BookingClientRow[]>(
      `SELECT id,name,email,identification,phone,license
       FROM booking_clients
       WHERE ($1::text IS NULL OR lower(email)=$1)
         AND ($2::text IS NULL OR identification=$2)
       LIMIT 1`,
      [email, identification],
    );
    if (!client) throw new NotFoundException('Cliente no encontrado.');
    return this.view(client);
  }

  async create(body: CreateBookingClientDto): Promise<{ client_id: string }> {
    const normalized = {
      nombre: body.nombre.trim(),
      email: body.email.trim().toLowerCase(),
      identificacion: body.identificacion.trim(),
      telefono: body.telefono.trim(),
      licencia: body.licencia.trim(),
    };
    return this.db.transaction(async (manager) => {
      const lockKeys = [
        `booking-client:email:${normalized.email}`,
        `booking-client:identification:${normalized.identificacion}`,
      ].sort();
      for (const key of lockKeys)
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [key],
        );

      const matches = await manager.query<BookingClientRow[]>(
        `SELECT id,name,email,identification,phone,license
         FROM booking_clients
         WHERE lower(email)=$1 OR identification=$2
         FOR UPDATE`,
        [normalized.email, normalized.identificacion],
      );
      const ids = new Set(matches.map((client) => client.id));
      if (ids.size > 1)
        throw new ConflictException(
          'El email y la identificacion pertenecen a clientes diferentes.',
        );
      const existing = matches[0];
      if (existing) {
        await manager.query(
          `UPDATE booking_clients SET name=$2,email=$3,identification=$4,
             phone=$5,license=$6,updated_at=now() WHERE id=$1`,
          [
            existing.id,
            normalized.nombre,
            normalized.email,
            normalized.identificacion,
            normalized.telefono,
            normalized.licencia,
          ],
        );
        return { client_id: existing.id };
      }
      const id = randomUUID();
      await manager.query(
        `INSERT INTO booking_clients(id,name,email,identification,phone,license)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [
          id,
          normalized.nombre,
          normalized.email,
          normalized.identificacion,
          normalized.telefono,
          normalized.licencia,
        ],
      );
      return { client_id: id };
    });
  }

  async findForDriver(
    manager: EntityManager,
    driver: DriverDetails,
  ): Promise<BookingClientRow | null> {
    const email = this.text(driver.email)?.toLowerCase() ?? null;
    const identification =
      this.text(driver.identificacion) ??
      this.text(driver.documento) ??
      null;
    const license =
      this.text(driver.license_number) ??
      this.text(driver.numero_licencia) ??
      null;
    if (!email && !identification && !license) return null;
    const matches = await manager.query<BookingClientRow[]>(
      `SELECT id,name,email,identification,phone,license
       FROM booking_clients
       WHERE ($1::text IS NOT NULL AND lower(email)=$1)
          OR ($2::text IS NOT NULL AND identification=$2)
          OR ($3::text IS NOT NULL AND license=$3)
       ORDER BY id`,
      [email, identification, license],
    );
    if (new Set(matches.map((client) => client.id)).size > 1)
      throw new ConflictException(
        'Los datos del conductor identifican clientes diferentes.',
      );
    return matches[0] ?? null;
  }

  async requireForDriver(
    manager: EntityManager,
    driver: DriverDetails,
  ): Promise<BookingClientRow> {
    const client = await this.findForDriver(manager, driver);
    if (!client)
      throw new UnprocessableEntityException(
        'El conductor debe registrarse en /api/v3/clientes antes de crear la reserva.',
      );
    return client;
  }

  private view(client: BookingClientRow) {
    return {
      client_id: client.id,
      nombre: client.name,
      email: client.email,
      identificacion: client.identification,
    };
  }

  private text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
