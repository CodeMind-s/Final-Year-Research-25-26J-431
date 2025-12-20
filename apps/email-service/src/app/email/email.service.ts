import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('EMAIL_HOST'),
        port: this.configService.get<number>('EMAIL_PORT'),
        secure: this.configService.get<boolean>('EMAIL_SECURE') === true, // true for 465, false for other ports
        auth: {
          user: this.configService.get<string>('EMAIL_USER'),
          pass: this.configService.get<string>('EMAIL_PASSWORD'),
        },
      });
      this.logger.log('Email transporter initialized successfully');
    } catch (error: any) {
      this.logger.error(`Failed to initialize email transporter: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Email service initialization failed');
    }
  }

  async sendOtpEmail(email: string, code: string): Promise<void> {
    try {
      const appName = this.configService.get<string>('APP_NAME') || 'Brinex';
      const from = this.configService.get<string>('EMAIL_FROM') || `${appName} <no-reply@brinex.com>`;

      const mailOptions = {
        from,
        to: email,
        subject: `Your ${appName} OTP Code`,
        html: this.getOtpEmailTemplate(code, appName),
        text: `Your OTP code is ${code}. It is valid for 10 minutes.`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent successfully to ${email}. Message ID: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`Failed to send OTP email to ${email}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  private getOtpEmailTemplate(code: string, appName: string): string {
    // Using inline HTML because webpack clears dist on rebuild, deleting copied Pug files
    // Pug template exists at src/app/email/templates/otp-email.pug for reference
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background-color: #f0f4f9a8;
            border-radius: 12px;
            padding: 32px;
            max-width: 600px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin: 20px auto;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid #f0f0f0;
          }
          .logo {
            display: block;
            margin: 0 auto 10px;
            text-align: center;
          }
          .logo img {
            max-width: 200px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          .otp-code {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            font-size: 32px;
            font-weight: bold;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            letter-spacing: 8px;
            margin: 30px 0;
          }
          .content {
            color: #555;
            font-size: 16px;
            margin-bottom: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #888;
            font-size: 14px;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
          }
          .warning p {
            margin: 0;
            color: #856404;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">
              <img src="https://res.cloudinary.com/dq2bkcxxd/image/upload/v1766221372/logo_otbl3q.png" alt="Brinex Logo" />
            </div>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            <p>You requested a One-Time Password (OTP) to sign in to your ${appName} account.</p>
            <p>Your verification code is:</p>
          </div>
          
          <div class="otp-code">
            ${code}
          </div>
          
          <div class="content">
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
          </div>
          
          <div class="warning">
            <p><strong>⚠️ Security Reminder:</strong> Never share this code with anyone. ${appName} will never ask for your OTP via phone or email.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
