import { FilterQuery, QueryOptions, UpdateQuery } from 'mongoose';
import { IPaginatedResult, IPaginationQuery } from './pagination.interface';

export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  findAll(filter?: FilterQuery<T>, options?: QueryOptions): Promise<T[]>;
  findPaginated(
    filter: FilterQuery<T>,
    pagination: IPaginationQuery,
  ): Promise<IPaginatedResult<T>>;
  create(data: Partial<T>): Promise<T>;
  updateById(id: string, data: UpdateQuery<T>): Promise<T | null>;
  deleteById(id: string): Promise<T | null>;
  count(filter?: FilterQuery<T>): Promise<number>;
  exists(filter: FilterQuery<T>): Promise<boolean>;
}
