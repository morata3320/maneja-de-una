import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AutosV2Guard, AutosV2Scopes } from '../autos-v2/autos-v2.guard';
import {
  CreateBookingClientDto,
  FindBookingClientDto,
} from './booking-clients.dto';
import { BookingClientsService } from './booking-clients.service';

@ApiTags('Booking Central V3.1 Clients')
@ApiSecurity('ApiKeyAuth')
@Controller('api/v3/clientes')
@UseGuards(AutosV2Guard)
export class BookingClientsController {
  constructor(private readonly clients: BookingClientsService) {}

  @Get()
  @AutosV2Scopes('autos:read')
  find(@Query() query: FindBookingClientDto) {
    return this.clients.find(query);
  }

  @Post()
  @AutosV2Scopes('autos:book')
  create(@Body() body: CreateBookingClientDto) {
    return this.clients.create(body);
  }
}
