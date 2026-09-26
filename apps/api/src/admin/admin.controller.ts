import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiBody, ApiParam } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
type SchemaObject = NonNullable<
  NonNullable<OpenAPIObject['components']>['schemas']
>[string];
import { InternalGuard, AdminGuard } from '../auth/internal.guard';
import { AdminService } from './admin.service';
import { resources, resourceSchema } from './admin.schemas';
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(InternalGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('orders') orders(@Query() query: Record<string, string>) {
    return this.admin.orders(query);
  }
  @Get(':resource')
  @ApiParam({ name: 'resource', enum: Object.keys(resources) })
  list(
    @Param('resource') resource: string,
    @Query() query: Record<string, string>,
  ) {
    return this.admin.list(resource, query);
  }
  @Get(':resource/:id') get(
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return this.admin.get(resource, id);
  }
  @Post(':resource')
  @ApiBody({
    schema: {
      oneOf: Object.keys(resources).map(
        (n) => resourceSchema(n) as SchemaObject,
      ),
    },
  })
  create(@Param('resource') resource: string, @Body() body: unknown) {
    return this.admin.write(resource, body);
  }
  @Patch(':resource/:id')
  @ApiBody({
    schema: {
      oneOf: Object.keys(resources).map(
        (n) => resourceSchema(n, true) as SchemaObject,
      ),
    },
  })
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.admin.write(resource, body, id);
  }
  @Delete(':resource/:id') @HttpCode(204) async remove(
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    await this.admin.deactivate(resource, id);
  }
}
