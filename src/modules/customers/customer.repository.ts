import { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { BaseRepository } from '../../database/base.repository';
import { CustomerModel, ICustomer } from './customer.model';
import { IPaginatedResult, IPaginationQuery } from '../../common/interfaces';
import { CustomerGroup } from '../../common/constants';
import { hmac, normalizePhone } from '../../common/utils/encryption';

@Service()
export class CustomerRepository extends BaseRepository<ICustomer> {
  constructor() {
    super(CustomerModel);
  }

  /**
   * Find a customer by phone number.
   * The caller still passes the plaintext phone number; we hash it here
   * (same normalization + HMAC key used at write time) and look it up via
   * the phoneNumberHash blind index, since the raw number is never stored.
   */
  async findByPhoneNumber(phoneNumber: string): Promise<ICustomer | null> {
    const phoneNumberHash = hmac(normalizePhone(phoneNumber));
    return this.model.findOne({ phoneNumberHash }).exec();
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
   * `customerData` must already contain the encrypted/hashed fields
   * (phoneNumberEncrypted, phoneNumberHash, fullNameEncrypted, fullNameIndex, ...)
   * prepared by the service layer — this method only resolves *which* document
   * to match via the blind index.
   */
  async upsertByPhoneNumber(phoneNumber: string, customerData: Partial<ICustomer>): Promise<ICustomer> {
    const phoneNumberHash = hmac(normalizePhone(phoneNumber));
    return this.model.findOneAndUpdate(
      { phoneNumberHash },
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