import { Service } from 'typedi';
import { BaseRepository } from '../../database/base.repository';
import { UserModel, IUser } from './user.model';

@Service()
export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  /**
   * Find a user by email. Includes the password field for auth verification.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return this.model.findOne({ email }).select('+password').exec();
  }

  /**
   * Find a user by email WITHOUT the password (for profile/display).
   */
  async findByEmailPublic(email: string): Promise<IUser | null> {
    return this.model.findOne({ email }).exec();
  }

  /**
   * Find all active users.
   */
  async findActiveUsers(): Promise<IUser[]> {
    return this.model.find({ isActive: true }).exec();
  }
}
