import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/get-current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SponsorTxnDto } from './dto/sponsor-txn.dto';
import { TransactionService } from './transaction.service';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('sponsorTxnSubmit')
  @UseGuards(JwtAuthGuard)
  sponsorTxnSubmit(@Body() body: SponsorTxnDto, @CurrentUser() user: any) {
    const uid = user.id;
    const transaction = body.transaction;
    const signature = body.signature;
    const payload = body.payload;
    return this.transactionService.sponsorTxnSubmit(
      transaction,
      signature,
      uid,
      payload
    );
  }
}
