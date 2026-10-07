import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hash, compare } from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { requiredSecret } from '../security/token-verifier';
import type { UserRow } from '../persistence/rows';
import type { LoginDto, RegisterDto } from './auth.dto';
export type PublicUser = Pick<
  UserRow,
  | 'id'
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'cedula'
  | 'phone'
  | 'email'
  | 'active'
  | 'status'
> & { role: 'CUSTOMER' | 'ADMIN' };
export const publicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  name: u.name,
  first_name: u.first_name,
  last_name: u.last_name,
  cedula: u.cedula,
  phone: u.phone,
  email: u.email,
  role: u.role === 'USER' ? 'CUSTOMER' : u.role,
  active: u.active,
  status: u.status,
});
@Injectable()
export class AuthService {
  private readonly key: Uint8Array;
  constructor(private readonly db: DataSource) {
    this.key = new TextEncoder().encode(requiredSecret('INTERNAL_JWT_SECRET'));
    if (process.env.INTERNAL_JWT_SECRET === process.env.AUTOS_LOCAL_JWT_SECRET)
      throw new Error('Separar secretos JWT internos y externos.');
  }
  async register(body: RegisterDto): Promise<PublicUser> {
    if (Buffer.byteLength(body.password, 'utf8') > 72)
      throw new BadRequestException('Contraseña excede 72 bytes.');
    const rows = await this.db.query<UserRow[]>(
      "INSERT INTO users(id,name,first_name,last_name,email,password_hash,role,status) VALUES($1,$2,$2,'',$3,$4,'USER','ACTIVE') ON CONFLICT(email) DO NOTHING RETURNING *",
      [
        randomUUID(),
        body.name,
        body.email.trim().toLowerCase(),
        await hash(body.password, 12),
      ],
    );
    if (!rows.length) throw new ConflictException('Email ya registrado.');
    return publicUser(rows[0]);
  }
  async login(
    body: LoginDto,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    if (Buffer.byteLength(body.password, 'utf8') > 72)
      throw new BadRequestException('Contraseña excede 72 bytes.');
    const [user] = await this.db.query<UserRow[]>(
      'SELECT * FROM users WHERE email=$1 AND active',
      [body.email.trim().toLowerCase()],
    );
    const valid = await compare(
      body.password,
      user?.password_hash ?? (await hash('unusable-dummy-password', 12)),
    );
    if (!user || !valid)
      throw new UnauthorizedException('Credenciales inválidas.');
    const accessToken = await new SignJWT({ role: user.role, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('urn:maneja:internal')
      .setAudience('maneja-web')
      .sign(this.key);
    return { accessToken, user: publicUser(user) };
  }
  async verify(token: string): Promise<PublicUser> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: 'urn:maneja:internal',
        audience: 'maneja-web',
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      const [user] = await this.db.query<UserRow[]>(
        'SELECT * FROM users WHERE id::text=$1 AND active',
        [payload.sub],
      );
      if (!user) throw new Error();
      return publicUser(user);
    } catch {
      throw new UnauthorizedException('Token interno inválido.');
    }
  }
}
