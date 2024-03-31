import { Account, Ed25519PrivateKey, MoveString } from '@aptos-labs/ts-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { validate } from '@tma.js/init-data-node';
import { parseInitData } from '@tma.js/sdk';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from 'src/prisma.service';
import { AptosService } from 'src/util/aptos.service';
import { createMultisigEntity } from './entities/auth.entity';
@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly aptosService: AptosService,
    private readonly configService: ConfigService,
  ) {}

  async googleBind(uid: bigint, idToken: string, address: string) {
    const oauth2Client = new OAuth2Client();
    const ticket = await oauth2Client.verifyIdToken({
      idToken,
      audience: this.configService.get('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    let googleWalletCnt = await this.prismaService.walletUser.count({
      where: {
        googleUser: {
          email,
        },
      },
    });

    if (googleWalletCnt > 0) {
      return 'Google account already exists';
    }

    const walletUser = await this.prismaService.walletUser.findUnique({
      where: {
        id: uid,
      },
      include: {
        googleUser: true,
      },
    });

    if (!walletUser) {
      return 'Wallet user not found';
    }

    if (walletUser.googleUser) {
      return 'Google account already exists';
    }

    await this.prismaService.walletUser.update({
      where: {
        id: uid,
      },
      data: {
        googleUser: {
          create: {
            email,
            address,
          },
        },
      },
    });

    return 'Google account bind success';
  }

  async googleLogin(idToken: string) {
    const oauth2Client = new OAuth2Client();
    const ticket = await oauth2Client.verifyIdToken({
      idToken,
      audience: this.configService.get('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    const walletUser = await this.prismaService.walletUser.findFirst({
      where: {
        googleUser: {
          email,
        },
      },
    });

    if (!walletUser) {
      return 'Wallet user not found';
    }

    const accessToken = await this.jwtService.signAsync({
      uid: walletUser.id.toString(),
    });

    return accessToken;
  }

  async tgLogin(initData: string) {
    try {
      validate(initData, this.configService.get('TELEGRAM_BOT_TOKEN'));
    } catch (error) {
      console.error(error);
      return 'Invalid init data';
    }
    const parsedInitData = parseInitData(initData);
    const tgId = parsedInitData.user.id;
    const username = parsedInitData.user.username;
    const firstName = parsedInitData.user.firstName;
    const lastName = parsedInitData.user.lastName;
    const walletUser = await this.prismaService.walletUser.findFirst({
      where: {
        telegramUser: {
          tgId,
        },
      },
    });

    let walletUserId = BigInt(0);
    if (!walletUser) {
      const newTgAccount = Account.generate();
      const newPlatformAccount = Account.generate();
      const newWalletUser = await this.prismaService.walletUser.create({
        data: {
          platformAddress: newPlatformAccount.accountAddress.toString(),
          platformPrivateKey: newPlatformAccount.privateKey.toString(),
          telegramUser: {
            create: {
              tgId,
              firstName,
              lastName,
              username,
              address: newTgAccount.accountAddress.toString(),
              privateKey: newTgAccount.privateKey.toString(),
            },
          },
        },
      });
      walletUserId = newWalletUser.id;
    } else {
      walletUserId = walletUser.id;
    }

    const accessToken = await this.jwtService.signAsync({
      uid: walletUserId.toString(),
    });

    return accessToken;
  }

  async getUser(uid: bigint) {
    return this.prismaService.walletUser.findUnique({
      where: {
        id: uid,
      },
      select: {
        id: true,
        telegramUser: {
          select: {
            tgId: true,
            address: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        passKey: {
          select: {
            address: true,
            publicKey: true,
            credential: true,
          },
        },
        googleUser: {
          select: {
            email: true,
            address: true,
          },
        },
        multiSigAddress: true,
      },
    });
  }

  async passkey(
    uid: bigint,
    address: string,
    publicKey: string,
    credential: string,
  ): Promise<createMultisigEntity> {
    const walletUser = await this.prismaService.walletUser.findUnique({
      where: {
        id: uid,
      },
      include: {
        telegramUser: true,
        passKey: true,
      },
    });

    if (!walletUser) {
      return {
        multisigAddress: '',
        transactionHash: '',
        errorMsg: 'Wallet user not found.',
      };
    }

    for (const passKey of walletUser.passKey) {
      if (passKey.address === address) {
        return {
          errorMsg: 'Passkey already exists',
          multisigAddress: '',
          transactionHash: '',
        };
      }
    }

    await this.prismaService.passKey.create({
      data: {
        publicKey: publicKey,
        credential: credential,
        address: address,
        walletUserId: uid,
      },
    });

    if (!walletUser.multiSigAddress) {
      const tgPrivateKey = new Ed25519PrivateKey(
        walletUser.telegramUser.privateKey,
      );
      const tgWallet = Account.fromPrivateKey({ privateKey: tgPrivateKey });
      const result = await this.createMultisig(
        address,
        tgWallet,
        walletUser.platformAddress,
      );
      await this.prismaService.walletUser.update({
        where: {
          id: uid,
        },
        data: {
          multiSigAddress: result.multisigAddress,
        },
      });
      return result;
    }
  }

  async createMultisig(
    passkeyAddress: string,
    walletAccount: Account,
    platformAddress: string,
  ): Promise<createMultisigEntity> {
    const payload: any = {
      function: this.configService.get('APTOS_GET_MULTISIG_ADDRESS_FUNCTION'),
      functionArguments: [walletAccount.accountAddress.toString(), '0'],
    };

    let multisigAddress: string;
    [multisigAddress] = await this.aptosService.aptos.view<[string]>({
      payload,
    });
    // Create the multisig account with 3 owners and a signature threshold of 2.
    const createMultisig =
      await this.aptosService.aptos.transaction.build.simple({
        sender: walletAccount.accountAddress,
        withFeePayer: true,
        data: {
          function: '0x1::multisig_account::create_with_owners',
          functionArguments: [
            [passkeyAddress, platformAddress],
            3,
            ['Fuzz'],
            [new MoveString('Init').bcsToBytes()],
          ],
        },
      });

    try {
      const txnHash = await this.aptosService.signAndSubmitWithFeePayer(
        walletAccount,
        createMultisig,
      );

      return {
        errorMsg: '',
        multisigAddress: multisigAddress,
        transactionHash: txnHash,
      };
    } catch (error) {
      return {
        errorMsg: error,
        multisigAddress: '',
        transactionHash: '',
      };
    }
  }
}
