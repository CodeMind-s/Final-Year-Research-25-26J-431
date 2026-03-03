import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Mock nodemailer before importing EmailService
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<ConfigService>;
  let mockTransporter: { sendMail: jest.Mock };

  const mockConfigValues: Record<string, any> = {
    EMAIL_HOST: 'smtp.example.com',
    EMAIL_PORT: 587,
    EMAIL_SECURE: false,
    EMAIL_USER: 'user@example.com',
    EMAIL_PASSWORD: 'password123',
    APP_NAME: 'Brinex',
    EMAIL_FROM: 'Brinex <no-reply@brinex.com>',
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-001' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => mockConfigValues[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor / initializeTransporter', () => {
    it('should initialize the transporter with config values', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'password123',
        },
      });
    });

    it('should throw InternalServerErrorException if transporter init fails', async () => {
      (nodemailer.createTransport as jest.Mock).mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => mockConfigValues[key]),
      };

      await expect(
        Test.createTestingModule({
          providers: [
            EmailService,
            { provide: ConfigService, useValue: mockConfigService },
          ],
        }).compile(),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('sendOtpEmail', () => {
    it('should send OTP email with correct mail options', async () => {
      await service.sendOtpEmail('recipient@example.com', '123456');

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe('Brinex <no-reply@brinex.com>');
      expect(mailOptions.to).toBe('recipient@example.com');
      expect(mailOptions.subject).toBe('Your Brinex OTP Code');
      expect(mailOptions.text).toBe('Your OTP code is 123456. It is valid for 10 minutes.');
      expect(mailOptions.html).toContain('123456');
    });

    it('should use default APP_NAME "Brinex" when not configured', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'APP_NAME') return undefined;
        if (key === 'EMAIL_FROM') return undefined;
        return mockConfigValues[key];
      });

      await service.sendOtpEmail('recipient@example.com', '999999');

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe('Brinex <no-reply@brinex.com>');
      expect(mailOptions.subject).toBe('Your Brinex OTP Code');
    });

    it('should include OTP code in HTML template', async () => {
      await service.sendOtpEmail('recipient@example.com', '654321');

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('654321');
      expect(mailOptions.html).toContain('Brinex');
      expect(mailOptions.html).toContain('One-Time Password');
      expect(mailOptions.html).toContain('10 minutes');
    });

    it('should include app name in HTML template', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'APP_NAME') return 'SaltApp';
        if (key === 'EMAIL_FROM') return 'SaltApp <no-reply@saltapp.com>';
        return mockConfigValues[key];
      });

      await service.sendOtpEmail('user@example.com', '111111');

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe('SaltApp <no-reply@saltapp.com>');
      expect(mailOptions.subject).toBe('Your SaltApp OTP Code');
      expect(mailOptions.html).toContain('SaltApp');
    });

    it('should throw InternalServerErrorException when sendMail fails', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(
        service.sendOtpEmail('recipient@example.com', '123456'),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.sendOtpEmail('recipient@example.com', '123456'),
      ).rejects.toThrow('Failed to send email');
    });

    it('should call sendMail exactly once per invocation', async () => {
      await service.sendOtpEmail('a@example.com', '111111');
      await service.sendOtpEmail('b@example.com', '222222');

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it('should use the correct "to" address for each call', async () => {
      await service.sendOtpEmail('first@example.com', '000001');

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe('first@example.com');
    });
  });
});
