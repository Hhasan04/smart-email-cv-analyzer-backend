import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GmailWebhookService } from './gmail-webhook.service';
import type { PubSubPushDto } from './pubsub-push.dto';

@Controller('webhooks')
export class GmailWebhookController {
  constructor(
    private readonly gmailWebhookService: GmailWebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post('gmail')
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: PubSubPushDto,
    @Query('token') token: string | undefined,
  ): Promise<void> {
    const expectedToken = this.configService.getOrThrow<string>(
      'PUBSUB_VERIFICATION_TOKEN',
    );
    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid Pub/Sub verification token');
    }

    await this.gmailWebhookService.processNotification(body);
  }
}
