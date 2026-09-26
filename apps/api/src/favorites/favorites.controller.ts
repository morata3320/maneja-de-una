import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { InternalGuard } from '../auth/internal.guard';
import type { InternalRequest } from '../auth/internal.guard';
@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(InternalGuard)
export class FavoritesController {
  constructor(private readonly db: DataSource) {}
  @Get() list(
    @Req() req: InternalRequest,
  ): Promise<Array<{ id: string; vehicleId: string; createdAt: Date }>> {
    return this.db.query(
      'SELECT id,vehicle_id AS "vehicleId",created_at AS "createdAt" FROM favorites WHERE user_id=$1 ORDER BY created_at',
      [req.user.id],
    );
  }
  @Post(':vehicleId') async add(
    @Param('vehicleId', new ParseUUIDPipe()) id: string,
    @Req() req: InternalRequest,
  ) {
    const rows = await this.db.query<Array<{ id: string }>>(
      'SELECT id FROM vehicles WHERE id=$1 AND active',
      [id],
    );
    if (!rows.length) throw new NotFoundException();
    await this.db.query(
      'INSERT INTO favorites(id,user_id,vehicle_id) VALUES($1,$2,$3) ON CONFLICT(user_id,vehicle_id) DO NOTHING',
      [randomUUID(), req.user.id, id],
    );
    return { vehicleId: id };
  }
  @Delete(':vehicleId') @HttpCode(204) async remove(
    @Param('vehicleId', new ParseUUIDPipe()) id: string,
    @Req() req: InternalRequest,
  ): Promise<void> {
    await this.db.query(
      'DELETE FROM favorites WHERE user_id=$1 AND vehicle_id=$2',
      [req.user.id, id],
    );
  }
}
