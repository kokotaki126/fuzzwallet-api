import {
  Account,
  AccountAuthenticator,
  Deserializer,
  Ed25519PrivateKey,
  RawTransaction
} from '@aptos-labs/ts-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';
import { AptosService } from 'src/util/aptos.service';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly aptosService: AptosService,
    private readonly configService: ConfigService,
  ) {}

  async sponsorTxnSubmit(transaction: string, signature: string, uid: bigint, payload: string) {
    try {
      let tmpTransaction = new Deserializer(
        Buffer.from(transaction.replace(/^0x/, ''), 'hex'),
      );
      let rawTransaction = RawTransaction.deserialize(tmpTransaction);

      let tmpSignature = new Deserializer(
        Buffer.from(signature.replace(/^0x/, ''), 'hex'),
      );
      let signatureData = AccountAuthenticator.deserialize(tmpSignature);

      const createMultisigTxn = await this.aptosService.submitFeePayerTransaction(
        rawTransaction,
        signatureData,
      );

      console.log(createMultisigTxn)

      const walletUser = await this.prismaService.walletUser.findUnique({
        where: {
          id: uid,
        },
        include: {
          googleUser: true,
          telegramUser: true,
        },
      });

      const txnNumber = await this.aptosService.getCurrentSeqNumber(
        walletUser.multiSigAddress,
      );

      const tgPrivatekey = new Ed25519PrivateKey(
        walletUser.telegramUser.privateKey,
      );
      const tgAccount = Account.fromPrivateKey({ privateKey: tgPrivatekey });
      const approve1 = await this.aptosService.approvePendingTransaction(
        tgAccount,
        walletUser.multiSigAddress,
        txnNumber,
      );
      console.log(approve1);
      const platformPrivateKey = new Ed25519PrivateKey(
        walletUser.platformPrivateKey,
      );
      const platformAccount = Account.fromPrivateKey({
        privateKey: platformPrivateKey,
      });
      const approve2 = await this.aptosService.approvePendingTransaction(
        platformAccount,
        walletUser.multiSigAddress,
        txnNumber,
      );
      console.log(approve2);

      const rawPayload = JSON.parse(atob(payload))

      const txn = await this.aptosService.executeMultisigTransaction(
        tgAccount,
        rawPayload,
        walletUser.multiSigAddress
      );
      console.log(txn);
      return txn;
    } catch (error) {
      console.error(error);
      return error;
    }
  }
}
