import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const DOMAIN = configService.get('DOMAIN');
  const NODE_ENV = configService.get('NODE_ENV');
  if (NODE_ENV != 'production') {
    app.enableCors();
    const config = new DocumentBuilder().setTitle('APTOS WALLET').build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('doc', app, document);
  } else {
    app.enableCors({
      origin: DOMAIN.split(','),
      credentials: true,
    });
  }
  BigInt.prototype['toJSON'] = function () {
    return this.toString();
  };
  await app.listen(parseInt(configService.get('PORT')));
}
bootstrap();
