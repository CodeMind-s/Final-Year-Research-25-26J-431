import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EmailService } from './email.service';

@Controller()
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(private readonly emailService: EmailService) {}

  @EventPattern('send_verification_code_email')
  async handleSendVerificationEmail(@Payload() data: any) {
    try {
      this.logger.log(`Received send_verification_code_email event: ${JSON.stringify(data)}`);
      
      const { user, code } = data;
      const email = user?.email;

      if (!email || !code) {
        this.logger.error('Invalid event data: missing email or code');
        return;
      }

      await this.emailService.sendOtpEmail(email, code);
      this.logger.log(`Successfully processed OTP email for ${email}`);
    } catch (error: any) {
      this.logger.error(`Error handling send_verification_code_email: ${error.message}`, error.stack);
    }
  }
}
