import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

require('dotenv').config();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // secretOrKey: `Todo-Protect Me`,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // return { userId: payload.sub, username: payload.username };
    let user = await this.authService.getUser(payload.uid);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
