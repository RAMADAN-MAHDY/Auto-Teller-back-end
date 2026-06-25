import Container, { Service } from 'typedi';
import { UserRepository } from './user.repository';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { hashPassword } from '../../common/utils/password';
import { IPaginatedResult, IPaginationQuery } from '../../common/interfaces';
import { IUser } from './user.model';
import { logger } from '../../logger';

@Service()
export class UserService {
  private readonly userRepository = Container.get(UserRepository);

  /**
   * Create a new user.
   */
  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    // Check for duplicate email
    const existingUser = await this.userRepository.findByEmailPublic(dto.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Hash the password
    const hashedPassword = await hashPassword(dto.password);

    const user = await this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });

    logger.info(`User created: ${user.email}`);
    return this.toResponseDto(user);
  }

  /**
   * Get all users with pagination.
   */
  async findAll(pagination: IPaginationQuery): Promise<IPaginatedResult<UserResponseDto>> {
    const result = await this.userRepository.findPaginated({}, pagination);
    return {
      data: result.data.map(this.toResponseDto),
      meta: result.meta,
    };
  }

  /**
   * Get a user by ID.
   */
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponseDto(user);
  }

  /**
   * Update a user by ID.
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    // If email is being updated, check for duplicates
    if (dto.email) {
      const existing = await this.userRepository.findByEmailPublic(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    const user = await this.userRepository.updateById(id, dto);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    logger.info(`User updated: ${user.email}`);
    return this.toResponseDto(user);
  }

  /**
   * Delete a user by ID.
   */
  async delete(id: string): Promise<void> {
    const user = await this.userRepository.deleteById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    logger.info(`User deleted: ${user.email}`);
  }

  /**
   * Map IUser document to UserResponseDto (never expose password).
   */
  private toResponseDto(user: IUser): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
