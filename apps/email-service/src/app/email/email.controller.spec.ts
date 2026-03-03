import { Test, TestingModule } from '@nestjs/testing';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

describe('EmailController', () => {
  let controller: EmailController;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const mockEmailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    controller = module.get<EmailController>(EmailController);
    emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSendVerificationEmail', () => {
    it('should call emailService.sendOtpEmail with correct email and code', async () => {
      const payload = {
        user: { email: 'test@example.com' },
        code: '123456',
      };

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('should not throw when emailService processes successfully', async () => {
      const payload = {
        user: { email: 'success@example.com' },
        code: '654321',
      };

      await expect(
        controller.handleSendVerificationEmail(payload),
      ).resolves.not.toThrow();
    });

    it('should not call sendOtpEmail when email is missing (user is null)', async () => {
      const payload = {
        user: null,
        code: '123456',
      };

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should not call sendOtpEmail when user object has no email', async () => {
      const payload = {
        user: { name: 'No Email User' },
        code: '123456',
      };

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should not call sendOtpEmail when user is undefined', async () => {
      const payload = {
        code: '123456',
      };

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should not call sendOtpEmail when code is missing', async () => {
      const payload = {
        user: { email: 'test@example.com' },
      };

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should not call sendOtpEmail when code is empty string', async () => {
      const payload = {
        user: { email: 'test@example.com' },
        code: '',
      };

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should not call sendOtpEmail when both email and code are missing', async () => {
      const payload = {};

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should catch and not rethrow when emailService throws (fire-and-forget)', async () => {
      emailService.sendOtpEmail.mockRejectedValue(new Error('SMTP failure'));

      const payload = {
        user: { email: 'test@example.com' },
        code: '123456',
      };

      // Should not throw despite the service error
      await expect(
        controller.handleSendVerificationEmail(payload),
      ).resolves.not.toThrow();

      expect(emailService.sendOtpEmail).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('should handle payload with additional fields gracefully', async () => {
      const payload = {
        user: { email: 'user@example.com', name: 'Extra User', phone: '1234567890' },
        code: '555555',
        extraField: 'should be ignored',
      };

      await controller.handleSendVerificationEmail(payload);

      expect(emailService.sendOtpEmail).toHaveBeenCalledWith('user@example.com', '555555');
    });
  });
});
