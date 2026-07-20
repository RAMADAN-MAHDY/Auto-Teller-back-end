import { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { BaseRepository } from '../../database/base.repository';
import { CustomerModel, ICustomer } from './customer.model';
import { IPaginatedResult, IPaginationQuery } from '../../common/interfaces';
import { CustomerGroup } from '../../common/constants';

@Service()
export class CustomerRepository extends BaseRepository<ICustomer> {
  constructor() {
    super(CustomerModel);
  }

  /**
   * Find a customer by phone number.
   */
  async findByPhoneNumber(phoneNumber: string): Promise<ICustomer | null> {
    return this.model.findOne({ phoneNumber }).exec();
  }

  /**
   * Find customers by customer group with pagination.
   */
  async findByCustomerGroup(
    customerGroup: CustomerGroup,
    pagination: IPaginationQuery,
  ): Promise<IPaginatedResult<ICustomer>> {
    return this.findPaginated({ customerGroup } as FilterQuery<ICustomer>, pagination);
  }

  /**
   * Upsert a customer by phone number.
   */
  async upsertByPhoneNumber(phoneNumber: string, customerData: Partial<ICustomer>): Promise<ICustomer> {
    return this.model.findOneAndUpdate(
      { phoneNumber: phoneNumber },
      customerData,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  }

  /**
   * Find all customers (no pagination, for scheduler processing).
   */
  async findAllCustomers(): Promise<ICustomer[]> {
    return this.model.find({}).exec();
  }

  /**
   * Delete all customers from the database.
   */
  async deleteAllCustomers(): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany({}).exec();
    return { deletedCount: result.deletedCount || 0 };
  }
}
