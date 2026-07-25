import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshTokenDto, RegisterDto } from './auth.dto';
import { sendCreated, sendSuccess } from '../../common/utils';
import { AuthenticatedRequest } from '../../common/interfaces';
import { UnauthorizedException } from '../../common/exceptions';

@Service()
export class AuthController {
  private readonly authService = Container.get(AuthService);

  /**
   * POST /api/v1/auth/register
   */
  register = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as RegisterDto;
    const result = await this.authService.register(dto);
    sendCreated(res, result, 'Registration successful');
  };

  /**
   * POST /api/v1/auth/login
   */
  login = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as LoginDto;
    const result = await this.authService.login(dto);
    sendSuccess(res, result, 'Login successful');
  };

  /**
   * POST /api/v1/auth/refresh
   */
  refresh = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body as RefreshTokenDto;
    const result = await this.authService.refreshToken(refreshToken);
    sendSuccess(res, result, 'Token refreshed successfully');
  };

  /**
   * PATCH /api/v1/auth/change-password
   */
  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const dto = req.body as ChangePasswordDto;
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const result = await this.authService.changePassword(userId, dto);
    sendSuccess(res, result, 'Password changed successfully');
  };
}
