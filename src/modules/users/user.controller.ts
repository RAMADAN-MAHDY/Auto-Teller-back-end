import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { PaginationQueryDto } from '../../common/dto';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils';

@Service()
export class UserController {
  private readonly userService = Container.get(UserService);

  /**
   * POST /api/v1/users
   */
  create = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as CreateUserDto;
    const user = await this.userService.create(dto);
    sendCreated(res, user, 'User created successfully');
  };

  /**
   * GET /api/v1/users
   */
  findAll = async (req: Request, res: Response): Promise<void> => {
    const pagination = req.query as unknown as PaginationQueryDto;
    const result = await this.userService.findAll(pagination);
    sendSuccess(res, result.data, 'Users retrieved successfully', 200, result.meta);
  };

  /**
   * GET /api/v1/users/:id
   */
  findById = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.findById(req.params.id as string);
    sendSuccess(res, user, 'User retrieved successfully');
  };

  /**
   * PATCH /api/v1/users/:id
   */
  update = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as UpdateUserDto;
    const user = await this.userService.update(req.params.id as string, dto);
    sendSuccess(res, user, 'User updated successfully');
  };

  /**
   * DELETE /api/v1/users/:id
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    await this.userService.delete(req.params.id as string);
    sendNoContent(res);
  };
}
