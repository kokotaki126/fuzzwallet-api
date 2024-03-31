import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { BindGoogleDto, CreatePasskeyDto } from './dto/auth.dto';
import { CurrentUser } from './get-current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('tg_login')
  tgLogin(@Request() req: any) {
    const initData = require('url').parse(req.url).query;
    return this.authService.tgLogin(initData);
  }

  @Post('google_login')
  googleLogin(@Body() body: BindGoogleDto) {
    const idToken = body.idToken
    return this.authService.googleLogin(idToken)
  }

  @Post('google_bind')
  @UseGuards(JwtAuthGuard)
  googleBind(@Body() body: BindGoogleDto, @CurrentUser() user: any) {
    const uid = user.id;
    const idToken = body.idToken;
    const address = body.address;
    return this.authService.googleBind(uid, idToken, address);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: any) {
    const uid = user.id;
    return this.authService.getUser(uid);
  }

  @Post('passkey')
  @UseGuards(JwtAuthGuard)
  passkey(@Body() body: CreatePasskeyDto, @CurrentUser() user: any) {
    const uid = user.id;
    const address = body.address;
    const publicKey = body.publicKey;
    const credential = body.credential;
    return this.authService.passkey(uid, address, publicKey, credential);
  }
}
