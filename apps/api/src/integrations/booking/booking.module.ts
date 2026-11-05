import { Module } from '@nestjs/common';
import { BookingCheckinClient } from './booking-checkin.client';
import { BookingCheckinService } from './booking-checkin.service';
import { BookingClientsService } from './booking-clients.service';

@Module({
  providers: [
    BookingClientsService,
    BookingCheckinClient,
    BookingCheckinService,
  ],
  exports: [BookingClientsService, BookingCheckinService],
})
export class BookingModule {}
