import Container, { Service } from 'typedi';
import { UserRepository } from '../users/user.repository';
import { ConflictException, UnauthorizedException } from '../../common/exceptions';
import { comparePassword, hashPassword } from '../../common/utils/password';
import { generateTokenPair, verifyRefreshToken } from '../../common/utils/token';
import { JwtPayload } from '../../common/interfaces';
import { AUTH_CONSTANTS } from '../../common/constants';
import {
  ChangePasswordDto,
  LoginDto,
  LoginResponseDto,
  RefreshResponseDto,
  RegisterDto,
} from './auth.dto';
import { logger } from '../../logger';

@Service()
export class AuthService {
  private readonly userRepository = Container.get(UserRepository);

  async register(dto: RegisterDto): Promise<LoginResponseDto> {
    const existing = await this.userRepository.findByEmailPublic(dto.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const hashedPassword = await hashPassword(dto.password);

    const user = await this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
    } as any);

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(payload);

    logger.info(`User registered successfully: ${user.email}`);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens: {
        ...tokens,
        tokenType: AUTH_CONSTANTS.TOKEN_TYPE,
      },
    };
  }

  /**
   * Authenticate a user with email and password.
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      logger.warn(`Login attempt with non-existent email: ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      logger.warn(`Login attempt by deactivated user: ${dto.email}`);
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await comparePassword(dto.password, user.password);

    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for: ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(payload);

    logger.info(`User logged in successfully: ${user.email}`);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens: {
        ...tokens,
        tokenType: AUTH_CONSTANTS.TOKEN_TYPE,
      },
    };
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshToken(refreshToken: string): Promise<RefreshResponseDto> {
    try {
      const decoded = verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const user = await this.userRepository.findById(decoded.userId);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const tokens = generateTokenPair(payload);

      return {
        ...tokens,
        tokenType: AUTH_CONSTANTS.TOKEN_TYPE,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findByIdWithPassword(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isCurrentPasswordValid = await comparePassword(dto.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(dto.newPassword);
    await this.userRepository.updateById(user.id, { password: hashedPassword } as any);

    logger.info(`Password changed successfully for user: ${user.email}`);

    return { message: 'Password changed successfully' };
  }
}
