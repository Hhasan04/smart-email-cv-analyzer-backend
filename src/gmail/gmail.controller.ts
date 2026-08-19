import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { GmailService } from './gmail.service';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('watch')
  async watch(@Req() req: Request): Promise<{ historyId: string }> {
    const authenticatedUser = req.user as AuthenticatedUser;
    const user = await this.usersService.findById(authenticatedUser.id);

    if (!user?.googleRefreshToken) {
      throw new BadRequestException(
        'Connect a Gmail account before starting a watch.',
      );
    }

    const gmail = this.gmailService.buildClient(user.googleRefreshToken);
    const { historyId } = await this.gmailService.watch(gmail);
    await this.usersService.saveGmailHistoryId(user.id, historyId);

    return { historyId };
  }
}
