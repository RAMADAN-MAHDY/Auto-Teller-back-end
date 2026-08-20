import Container, { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { CustomerRepository } from './customer.repository';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto, CustomerResponseDto } from './customer.dto';
import { ConflictException, NotFoundException, BadRequestException } from '../../common/exceptions';
import { IPaginatedResult } from '../../common/interfaces';
import { ICustomer } from './customer.model';
import { logger } from '../../logger';
import { ImportCustomerDto } from './import-customer.dto';
import { calculateCustomerGroupAndOverdueDays } from '../../common/utils';
import { CustomerGroup } from '../../common/constants';
import {
  encrypt,
  decrypt,
  hmac,
  hmacTrigrams,
  normalize,
  normalizePhone,
} from '../../common/utils/encryption';

@Service()
export class CustomerService {
  private readonly customerRepository = Container.get(CustomerRepository);

  // Create a new customer
  async create(dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    const existing = await this.customerRepository.findByPhoneNumber(dto.phoneNumber);
    if (existing) {
      throw new ConflictException('A customer with this phone number already exists');
    }

    const dueDate = new Date(dto.dueDate);
    const { overdueDays, customerGroup } = calculateCustomerGroupAndOverdueDays(dueDate);

    const customer = await this.customerRepository.create({
      ...this.toEncryptedFields(dto),
      dueDate,
      importedOverdueDays: dto.importedOverdueDays ?? 0,
      overdueDays,
      customerGroup,
    } as any);
    logger.info(`Customer created: ${customer.phoneNumberHash}`);
    return this.toResponseDto(customer);
  }

  // Bulk import customers from an array of customer data
  async importCustomers(customersData: ImportCustomerDto[]): Promise<{ imported: number; updated: number; failed: number; errors: string[] }> {
    let importedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const data of customersData) {
      try {
        // 1. Convert dueDate string to Date object
        const dueDate = new Date(data.dueDate);

        // 2. Calculate overdueDays and customerGroup
        const { overdueDays, customerGroup } = calculateCustomerGroupAndOverdueDays(dueDate);

        // 3. Process tags (comma-separated string to array)
        // const tagsArray = data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];

        // 4. Prepare customer data for upsert (encrypted + hashed)
        const customerToUpsert: Partial<ICustomer> = {
          ...this.toEncryptedFields(data),
          dueDate: dueDate,
          importedOverdueDays: data.importedOverdueDays ?? 0,
          overdueDays: overdueDays,
          customerGroup: customerGroup,
          // notes: data.notes || undefined,
          // tags: tagsArray,
        };

        // 5. Upsert customer by phone number
        const result = await this.customerRepository.upsertByPhoneNumber(data.phoneNumber, customerToUpsert);

        if (result.createdAt.getTime() === result.updatedAt.getTime()) { // Simple check if it was an insert
          importedCount++;
        } else {
          updatedCount++;
        }
      } catch (error: any) {
        failedCount++;
        const errorMessage = `Failed to import customer ${data.phoneNumber}: ${error.message || 'Unknown error'}`;
        errors.push(errorMessage);
        logger.error(errorMessage);
      }
    }

    logger.info(`Customer import completed. Imported: ${importedCount}, Updated: ${updatedCount}, Failed: ${failedCount}`);
    return { imported: importedCount, updated: updatedCount, failed: failedCount, errors };
  }

  async findAll(query: CustomerQueryDto): Promise<IPaginatedResult<CustomerResponseDto>> {
    const filter: FilterQuery<ICustomer> = {};

    if (query.search) {
      // Partial name search over encrypted data: translate the search text
      // into the same HMAC trigrams used at write time, then match documents
      // whose fullNameIndex contains ALL of those trigrams.
      const searchTrigrams = hmacTrigrams(query.search);
      if (searchTrigrams.length > 0) {
        filter.fullNameIndex = { $all: searchTrigrams };
      }
    }
    if (query.customerGroup) {
      filter.customerGroup = query.customerGroup;
    }
    // if (query.tag) {
    //   filter.tags = { $in: [query.tag] };
    // }

    const result = await this.customerRepository.findPaginated(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
    });

    return {
      data: result.data.map((customer) => this.toResponseDto(customer)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return this.toResponseDto(customer);
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerResponseDto> {
    if (dto.phoneNumber) {
      const existing = await this.customerRepository.findByPhoneNumber(dto.phoneNumber);
      if (existing && existing.id !== id) {
        throw new ConflictException('A customer with this phone number already exists');
      }
    }

    const updateData: Partial<ICustomer> = this.toEncryptedFields(dto, { partial: true });
    if (dto.dueDate) {
      const newDueDate = new Date(dto.dueDate);
      const { overdueDays, customerGroup } = calculateCustomerGroupAndOverdueDays(newDueDate);
      updateData.dueDate = newDueDate;
      updateData.overdueDays = overdueDays;
      updateData.customerGroup = customerGroup;
    }

    const customer = await this.customerRepository.updateById(id, updateData);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    logger.info(`Customer updated: ${customer.id}`);
    return this.toResponseDto(customer);
  }

  async delete(id: string): Promise<void> {
    const customer = await this.customerRepository.deleteById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    logger.info(`Customer deleted: ${customer.id}`);
  }

  async deleteAll(): Promise<{ deletedCount: number }> {
    const result = await this.customerRepository.deleteAllCustomers();
    logger.info(`All customers deleted. Total deleted: ${result.deletedCount}`);
    return result;
  }

  /**
   * Encrypts sensitive plaintext fields coming from a DTO and derives their
   * blind-index counterparts (hash / trigram index).
   *
   * `partial: true` is used for updates, where some fields may be undefined
   * and must simply be omitted (not overwritten with empty/garbage values).
   */
  private toEncryptedFields(
    dto: Partial<CreateCustomerDto | UpdateCustomerDto | ImportCustomerDto>,
    { partial = false }: { partial?: boolean } = {},
  ): Partial<ICustomer> {
    const fields: Partial<ICustomer> = {};

    if (dto.fullName !== undefined) {
      fields.fullNameEncrypted = encrypt(dto.fullName);
      fields.fullNameIndex = hmacTrigrams(dto.fullName);
    } else if (!partial) {
      throw new BadRequestException('Full name is required');
    }

    if (dto.phoneNumber !== undefined) {
      const normalizedPhone = normalizePhone(dto.phoneNumber);
      fields.phoneNumberEncrypted = encrypt(dto.phoneNumber);
      fields.phoneNumberHash = hmac(normalizedPhone);
    } else if (!partial) {
      throw new BadRequestException('Phone number is required');
    }

    if (dto.guarantorName) {
      fields.guarantorNameEncrypted = encrypt(dto.guarantorName);
    }

    if (dto.guarantorPhone) {
      fields.guarantorPhoneEncrypted = encrypt(dto.guarantorPhone);
      fields.guarantorPhoneHash = hmac(normalizePhone(dto.guarantorPhone));
    }

    return fields;
  }

  /**
   * Decrypts sensitive fields for API responses. This is the ONLY place
   * plaintext customer data should be reconstructed outside of writes.
   */
  private toResponseDto(customer: ICustomer): CustomerResponseDto {
    return {
      id: customer.id,
      fullName: decrypt(customer.fullNameEncrypted),
      phoneNumber: decrypt(customer.phoneNumberEncrypted),
      guarantorName: customer.guarantorNameEncrypted ? decrypt(customer.guarantorNameEncrypted) : undefined,
      guarantorPhone: customer.guarantorPhoneEncrypted ? decrypt(customer.guarantorPhoneEncrypted) : undefined,
      dueDate: customer.dueDate,
      importedOverdueDays: customer.importedOverdueDays ?? 0,
      overdueDays: customer.overdueDays,
      customerGroup: customer.customerGroup,
      // notes: customer.notes,
      // tags: customer.tags,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  /**
   * Recalculates overdue days and customer group for all customers.
   * Used by the daily scheduler. No sensitive fields are touched here,
   * so no encryption/decryption is needed.
   */
  async recalculateAllCustomerGroups(): Promise<{ updatedCount: number }> {
    const customers = await this.customerRepository.findAllCustomers();
    let updatedCount = 0;

    for (const customer of customers) {
      const { overdueDays, customerGroup } = calculateCustomerGroupAndOverdueDays(customer.dueDate);

      if (customer.overdueDays !== overdueDays || customer.customerGroup !== customerGroup) {
        await this.customerRepository.updateById(customer.id, {
          overdueDays,
          customerGroup,
        });
        updatedCount++;
      }
    }
    logger.info(`Recalculated customer groups for ${updatedCount} customers.`);
    return { updatedCount };
  }
}