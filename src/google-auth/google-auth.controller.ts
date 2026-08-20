import {
  Controller,
  Get,
  Logger,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleStatePayload } from './google-state.interface';

@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('url')
  getAuthUrl(@Req() req: Request): { url: string } {
    const user = req.user as AuthenticatedUser;
    const state = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'google-oauth-state',
      } satisfies GoogleStatePayload,
      { expiresIn: '10m' },
    );
    return { url: this.googleAuthService.buildAuthUrl(state) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req: Request): Promise<{
    connected: boolean;
    gmailAddress: string | null;
    watching: boolean;
  }> {
    const authenticatedUser = req.user as AuthenticatedUser;
    const user = await this.usersService.findById(authenticatedUser.id);
    return {
      connected: !!user?.googleRefreshToken,
      gmailAddress: user?.gmailAddress ?? null,
      watching: !!user?.gmailHistoryId,
    };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const callbackUrl = `${frontendUrl}/auth/google/callback`;

    if (error || !code || !state) {
      res.redirect(`${callbackUrl}?status=error`);
      return;
    }

    try {
      const payload = this.jwtService.verify<GoogleStatePayload>(state);
      if (payload.purpose !== 'google-oauth-state') {
        throw new Error('Invalid state token purpose');
      }

      const { refreshToken, gmailAddress } =
        await this.googleAuthService.exchangeCode(code);
      await this.usersService.saveGoogleLink(payload.sub, {
        refreshToken,
        gmailAddress,
      });

      res.redirect(`${callbackUrl}?status=success`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Google OAuth callback failed: ${error.message}`,
        error.stack,
      );
      res.redirect(`${callbackUrl}?status=error`);
    }
  }
}
