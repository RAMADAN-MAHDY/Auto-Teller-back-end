import {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  SortOrder,
} from 'mongoose';
import { IBaseRepository, IPaginatedResult, IPaginationQuery } from '../common/interfaces';

/**
 * Abstract base repository implementing common CRUD and pagination operations.
 * All module repositories extend this class to inherit standard data access patterns.
 */
export abstract class BaseRepository<T extends Document> implements IBaseRepository<T> {
  constructor(protected readonly model: Model<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async findAll(filter: FilterQuery<T> = {}, options?: QueryOptions): Promise<T[]> {
    return this.model.find(filter, null, options).exec();
  }

  async findPaginated(
    filter: FilterQuery<T>,
    pagination: IPaginationQuery,
    populate?: any,
  ): Promise<IPaginatedResult<T>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    const sortOption: Record<string, SortOrder> = { [sort]: order === 'asc' ? 1 : -1 };

    let queryBuilder = this.model.find(filter).sort(sortOption).skip(skip).limit(limit);
    if (populate) {
      queryBuilder = queryBuilder.populate(populate);
    }

    const [data, total] = await Promise.all([
      queryBuilder.exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async create(data: Partial<T>): Promise<T> {
    const document = new this.model(data);
    return document.save();
  }

  async updateById(id: string, data: UpdateQuery<T>): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .exec();
  }

  async deleteById(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const doc = await this.model.exists(filter);
    return doc !== null;
  }
}
