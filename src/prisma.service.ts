import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const options = {
  log: [
    {
      emit: 'event' as const,
      level: 'query' as const,
    },
    'info' as const,
    'warn' as const,
    'error' as const,
  ],
} satisfies Prisma.PrismaClientOptions;

@Injectable()
export class PrismaService
  extends PrismaClient<typeof options>
  implements OnModuleInit
{
  constructor() {
    super(options);
    //if (process.env.NODE_ENV != 'production') {
    //  this.$on('query', (e) => {
    //    console.log(e.query, e.params);
    //  });
    //}
  }
  async onModuleInit() {
    await this.$connect();
  }
}
