import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { AuthExceptionFilter } from '../../auth/filters/auth-exception.filter';
import { ApiTags, ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiUnauthorized, ApiForbidden, ApiValidationError, Public } from '../../core';
import { DisposableEmailService } from '../../auth/services/disposable-email.service';
import { AdminAddBlockedDomainsDto } from '../dto/admin-blocked-domain.dto';

/**
 * Admin-console management of the disposable/blocked email-domain list.
 * Mounted under the admin base path (e.g. `/auth/admin/api/blocked-email-domains`).
 */
@Controller('api/blocked-email-domains')
@UseFilters(AuthExceptionFilter)
@UseGuards(AdminSessionGuard)
@ApiTags('Admin · Blocked Email Domains')
@ApiCookieAuth('admin-session')
@ApiUnauthorized('Admin session missing or invalid.')
@ApiForbidden()
@ApiValidationError()
@Public() // exempt from a consumer's global APP_GUARD; AdminSessionGuard is the real guard
export class AdminBlockedDomainsController {
  constructor(private readonly disposable: DisposableEmailService) { }

  @ApiOperation({ summary: 'List blocked email domains (searchable, paginated)' })
  @Get()
  list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.disposable.list({
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @ApiOperation({ summary: 'Blocklist stats (current count + size of the built-in default list)' })
  @Get('stats')
  async stats() {
    return { count: await this.disposable.count(), defaultCount: this.disposable.defaultCount };
  }

  @ApiOperation({ summary: 'Add one or more blocked domains' })
  @ApiResponse({ status: 201, description: '{ added, skipped }' })
  @Post()
  add(@Body() dto: AdminAddBlockedDomainsDto) {
    return this.disposable.addDomains(dto.domains);
  }

  @ApiOperation({ summary: 'Import the built-in default disposable-domain list' })
  @ApiResponse({ status: 201, description: '{ imported, total }' })
  @Post('import-defaults')
  importDefaults() {
    return this.disposable.importDefaults();
  }

  @ApiOperation({ summary: 'Remove a blocked domain (by id or domain)' })
  @Delete(':idOrDomain')
  async remove(@Param('idOrDomain') idOrDomain: string) {
    await this.disposable.removeDomain(idOrDomain);
    return { message: 'Removed' };
  }
}
