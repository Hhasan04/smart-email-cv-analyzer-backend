import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GmailWebhookService } from './gmail-webhook.service';
import type { PubSubPushDto } from './pubsub-push.dto';

@Controller('webhooks')
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);

  constructor(
    private readonly gmailWebhookService: GmailWebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post('gmail')
  @HttpCode(HttpStatus.OK)
  handle(
    @Body() body: PubSubPushDto,
    @Query('token') token: string | undefined,
  ): void {
    const expectedToken = this.configService.getOrThrow<string>(
      'PUBSUB_VERIFICATION_TOKEN',
    );
    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid Pub/Sub verification token');
    }

    // Ack Pub/Sub immediately and process in the background. Waiting on the full
    // pipeline (Gemini calls can be slow/rate-limited) risks exceeding Pub/Sub's
    // ack deadline, which causes it to redeliver the same notification and
    // process everything twice.
    this.gmailWebhookService.processNotification(body).catch((error: Error) => {
      this.logger.error(
        `Unhandled error processing Pub/Sub notification: ${error.message}`,
        error.stack,
      );
    });
  }
}
