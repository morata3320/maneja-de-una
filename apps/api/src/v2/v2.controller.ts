import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AdminGuard,
  InternalGuard,
  type InternalRequest,
} from '../auth/internal.guard';
import {
  LoginV2Dto,
  PageQueryDto,
  PaymentDto,
  RegisterV2Dto,
  ReservationDto,
  ReservationPatchDto,
  SelfUpdateDto,
  UserCreateDto,
  UserStatusDto,
  UserUpdateDto,
  VehicleDto,
  VehiclePatchDto,
} from './dto';
import { V2Service } from './v2.service';

@ApiTags('Auth')
@Controller('api/v2/auth')
export class AuthV2Controller {
  constructor(private readonly s: V2Service) {}
  @Post('register') @ApiResponse({ status: 201 }) register(
    @Body() b: RegisterV2Dto,
  ) {
    return this.s.register(b);
  }
  @Post('login') @HttpCode(200) login(@Body() b: LoginV2Dto) {
    return this.s.login(b);
  }
  @Get('me') @UseGuards(InternalGuard) @ApiBearerAuth() me(
    @Req() r: InternalRequest,
  ) {
    return { ...r.user, role: r.user.role === 'CUSTOMER' ? 'USER' : r.user.role };
  }
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(InternalGuard)
@Controller('api/v2/users')
export class UsersV2Controller {
  constructor(private readonly s: V2Service) {}
  @Get() @UseGuards(AdminGuard) list(@Query() q: PageQueryDto) {
    return this.s.users(q as unknown as Record<string, unknown>);
  }
  @Get('me') me(@Req() r: InternalRequest) {
    return this.s.user(r.user.id);
  }
  @Patch('me') patchMe(@Req() r: InternalRequest, @Body() b: SelfUpdateDto) {
    return this.s.updateUser(r.user.id, b, true);
  }
  @Get(':id') @UseGuards(AdminGuard) get(@Param('id') id: string) {
    return this.s.user(id);
  }
  @Post() @UseGuards(AdminGuard) create(@Body() b: UserCreateDto) {
    return this.s.createUser(b);
  }
  @Put(':id') @UseGuards(AdminGuard) put(
    @Param('id') id: string,
    @Body() b: UserCreateDto,
  ) {
    return this.s.updateUser(id, b);
  }
  @Patch(':id/status') @UseGuards(AdminGuard) status(
    @Param('id') id: string,
    @Body() b: UserStatusDto,
  ) {
    return this.s.setUserStatus(id, b.status);
  }
  @Patch(':id') @UseGuards(AdminGuard) patch(
    @Param('id') id: string,
    @Body() b: UserUpdateDto,
  ) {
    return this.s.updateUser(id, b);
  }
  @Delete(':id') @UseGuards(AdminGuard) @HttpCode(204) remove(
    @Param('id') id: string,
  ) {
    return this.s.deleteUser(id);
  }
}

@ApiTags('Vehicles')
@Controller('api/v2/vehicles')
export class VehiclesV2Controller {
  constructor(private readonly s: V2Service) {}
  @Get()
  @ApiOperation({ summary: 'Catalogo paginado con filtros' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'transmission', required: false })
  @ApiQuery({ name: 'fuelType', required: false })
  @ApiQuery({ name: 'location', required: false })
  @ApiQuery({ name: 'supplier', required: false })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, enum: ['price_asc', 'price_desc'] })
  list(
    @Query() q: Record<string, unknown>,
  ) {
    return this.s.vehicles(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.s.vehicle(id);
  }
  @Post() @UseGuards(InternalGuard, AdminGuard) @ApiBearerAuth() create(
    @Body() b: VehicleDto,
  ) {
    return this.s.writeVehicle(b);
  }
  @Put(':id') @UseGuards(InternalGuard, AdminGuard) @ApiBearerAuth() put(
    @Param('id') id: string,
    @Body() b: VehicleDto,
  ) {
    return this.s.writeVehicle(b, id);
  }
  @Patch(':id') @UseGuards(InternalGuard, AdminGuard) @ApiBearerAuth() patch(
    @Param('id') id: string,
    @Body() b: VehiclePatchDto,
  ) {
    return this.s.writeVehicle(b, id);
  }
  @Delete(':id')
  @UseGuards(InternalGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.s.deleteVehicle(id);
  }
}

const catalogNames = [
  'brands',
  'vehicle-models',
  'categories',
  'locations',
  'suppliers',
  'depots',
  'depot-scores',
];
@ApiTags(
  'Brands',
  'Vehicle Models',
  'Categories',
  'Locations',
  'Suppliers',
  'Depots',
  'Depot Scores',
)
@ApiParam({ name: 'resource', enum: catalogNames })
@Controller('api/v2/:resource')
export class CatalogV2Controller {
  constructor(private readonly s: V2Service) {}
  private check(r: string) {
    if (!catalogNames.includes(r))
      throw new NotFoundException();
    return r;
  }
  @Get() list(
    @Param('resource') r: string,
    @Query() q: Record<string, unknown>,
  ) {
    return this.s.catalogList(this.check(r), q);
  }
  @Get(':id') get(@Param('resource') r: string, @Param('id') id: string) {
    return this.s.catalogGet(this.check(r), id);
  }
  @Post() @UseGuards(InternalGuard, AdminGuard) @ApiBearerAuth() create(
    @Param('resource') r: string,
    @Body() b: Record<string, unknown>,
  ) {
    return this.s.catalogWrite(this.check(r), b);
  }
  @Put(':id') @UseGuards(InternalGuard, AdminGuard) @ApiBearerAuth() put(
    @Param('resource') r: string,
    @Param('id') id: string,
    @Body() b: Record<string, unknown>,
  ) {
    return this.s.catalogWrite(this.check(r), b, id);
  }
  @Patch(':id') @UseGuards(InternalGuard, AdminGuard) @ApiBearerAuth() patch(
    @Param('resource') r: string,
    @Param('id') id: string,
    @Body() b: Record<string, unknown>,
  ) {
    return this.s.catalogWrite(this.check(r), b, id);
  }
  @Delete(':id')
  @UseGuards(InternalGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  remove(@Param('resource') r: string, @Param('id') id: string) {
    return this.s.catalogDelete(this.check(r), id);
  }
}

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(InternalGuard)
@Controller('api/v2/favorites')
export class FavoritesV2Controller {
  constructor(private readonly s: V2Service) {}
  @Get() list(@Req() r: InternalRequest) {
    return this.s.favorites(r.user.id);
  }
  @Post(':vehicleId') add(
    @Req() r: InternalRequest,
    @Param('vehicleId') v: string,
  ) {
    return this.s.addFavorite(r.user.id, v);
  }
  @Delete(':vehicleId') @HttpCode(204) remove(
    @Req() r: InternalRequest,
    @Param('vehicleId') v: string,
  ) {
    return this.s.removeFavorite(r.user.id, v);
  }
}

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(InternalGuard)
@Controller('api/v2/reservations')
export class ReservationsV2Controller {
  constructor(private readonly s: V2Service) {}
  @Post() create(@Req() r: InternalRequest, @Body() b: ReservationDto) {
    return this.s.createReservation(r.user.id, b);
  }
  @Get('my') mine(
    @Req() r: InternalRequest,
    @Query() q: Record<string, unknown>,
  ) {
    return this.s.reservations(r.user, false, q);
  }
  @Get() @UseGuards(AdminGuard) all(
    @Req() r: InternalRequest,
    @Query() q: Record<string, unknown>,
  ) {
    return this.s.reservations(r.user, true, q);
  }
  @Get(':id') get(@Req() r: InternalRequest, @Param('id') id: string) {
    return this.s.reservation(r.user, id);
  }
  @Patch(':id') patch(
    @Req() r: InternalRequest,
    @Param('id') id: string,
    @Body() b: ReservationPatchDto,
  ) {
    return this.s.updateReservation(r.user, id, b);
  }
  @Post(':id/cancel') @HttpCode(200) cancel(
    @Req() r: InternalRequest,
    @Param('id') id: string,
  ) {
    return this.s.cancelReservation(r.user, id);
  }
}

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(InternalGuard)
@Controller('api/v2/payments')
export class PaymentsV2Controller {
  constructor(private readonly s: V2Service) {}
  @Post('simulate') simulate(@Req() r: InternalRequest, @Body() b: PaymentDto) {
    return this.s.simulatePayment(r.user, b);
  }
  @Get() @UseGuards(AdminGuard) list() {
    return this.s.payments();
  }
}
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(InternalGuard, AdminGuard)
@Controller('api/v2/admin')
export class AdminV2Controller {
  constructor(private readonly s: V2Service) {}
  @Get('dashboard') dashboard() {
    return this.s.dashboard();
  }
}
@ApiTags('Health')
@Controller('api/v2/health')
export class HealthV2Controller {
  @Get() get() {
    return {
      status: 'ok',
      service: 'maneja-de-una-api',
      version: '2.0',
      timestamp: new Date().toISOString(),
    };
  }
}
