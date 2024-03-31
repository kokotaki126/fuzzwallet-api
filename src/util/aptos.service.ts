import {
  Account,
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
  RawTransaction,
  SimpleTransaction
} from '@aptos-labs/ts-sdk';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AptosService {
  aptos: Aptos;
  feePayer: Account;

  constructor(private configService: ConfigService) {
    let network: Network;
    switch (this.configService.get('APTOS_NETWORK')) {
      case 'mainnet':
        network = Network.MAINNET;
        break;
      case 'testnet':
        network = Network.TESTNET;
        break;
    }
    this.aptos = new Aptos(
      new AptosConfig({
        network: network,
      }),
    );
    const feePayerPrivateKey = new Ed25519PrivateKey(
      this.configService.get('APTOS_FEE_PAYER_PRIVATE_KEY'),
    );
    this.feePayer = Account.fromPrivateKey({ privateKey: feePayerPrivateKey });
  }

  async signAndSubmitWithFeePayer(sender: Account, txn: SimpleTransaction) {
    const senderSignature = this.aptos.sign({
      signer: sender,
      transaction: txn,
    });
    const feePayerSignature = this.aptos.signAsFeePayer({
      signer: this.feePayer,
      transaction: txn,
    });
    const committedTxn = await this.aptos.transaction.submit.simple({
      transaction: txn,
      senderAuthenticator: senderSignature,
      feePayerAuthenticator: feePayerSignature,
    });
    await this.aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });
    return committedTxn.hash;
  }

  async submitFeePayerTransaction(
    transaction: RawTransaction,
    signature: AccountAuthenticator,
  ): Promise<string> {
    let feePayerTransaction = {
      rawTransaction: transaction,
      feePayerAddress: this.feePayer.accountAddress,
    };
    let feePayerSignature = this.aptos.transaction.signAsFeePayer({
      signer: this.feePayer,
      transaction: feePayerTransaction,
    });
    let commitTransaction = await this.aptos.transaction.submit.simple({
      transaction: feePayerTransaction,
      senderAuthenticator: signature,
      feePayerAuthenticator: feePayerSignature,
    });

    await this.aptos.waitForTransaction({
      transactionHash: commitTransaction.hash,
    });
    return commitTransaction.hash;
  }

  async getCurrentSeqNumber(address: string) {
    const payload: any = {
      function: '0x1::multisig_account::next_sequence_number',
      typeArguments: [],
      functionArguments: [address],
    };

    const seq = await this.aptos.view<string[]>({ payload });
    return String(parseInt(seq[0]) - 1);
  }

  async approvePendingTransaction(
    sender: Account,
    multisigAddress: string,
    transactionId: string,
  ) {
    const approveTx = await this.aptos.transaction.build.simple({
      sender: sender.accountAddress,
      data: {
        function: '0x1::multisig_account::approve_transaction',
        functionArguments: [multisigAddress, transactionId],
      },
      withFeePayer: true,
    });

    return await this.signAndSubmitWithFeePayer(sender, approveTx);
  }

  async executeMultisigTransaction(
    sender: Account,
    payload: any,
    multisigAddress: string,
  ) {

    const simpleTransaction = await this.aptos.transaction.build.simple({
      sender: sender.accountAddress,
      withFeePayer: true,
      data: {
        multisigAddress, 
        ...payload,
      }
    })

    return await this.signAndSubmitWithFeePayer(sender, simpleTransaction)
  }
}
