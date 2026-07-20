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

@Service()
export class CustomerService {
  private readonly customerRepository = Container.get(CustomerRepository);

  async create(dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    const existing = await this.customerRepository.findByPhoneNumber(dto.phoneNumber);
    if (existing) {
      throw new ConflictException('A customer with this phone number already exists');
    }

    const dueDate = new Date(dto.dueDate);
    const { overdueDays, customerGroup } = calculateCustomerGroupAndOverdueDays(dueDate);

    const customer = await this.customerRepository.create({
      ...dto,
      dueDate,
      overdueDays,
      customerGroup,
    } as any);
    logger.info(`Customer created: ${customer.fullName} (${customer.phoneNumber})`);
    return this.toResponseDto(customer);
  }

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

        // 4. Prepare customer data for upsert
        const customerToUpsert: Partial<ICustomer> = {
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          guarantorName: data.guarantorName || undefined,
          guarantorPhone: data.guarantorPhone || undefined,
          dueDate: dueDate,
          importedOverdueDays: data.importedOverdueDays,
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
        const errorMessage = `Failed to import customer ${data.fullName || data.phoneNumber}: ${error.message || 'Unknown error'}`;
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
      filter.fullName = { $regex: query.search, $options: 'i' };
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
      data: result.data.map(this.toResponseDto),
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

    const updateData: Partial<ICustomer> = { ...dto } as any;
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

    logger.info(`Customer updated: ${customer.fullName}`);
    return this.toResponseDto(customer);
  }

  async delete(id: string): Promise<void> {
    const customer = await this.customerRepository.deleteById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    logger.info(`Customer deleted: ${customer.fullName}`);
  }

  async deleteAll(): Promise<{ deletedCount: number }> {
    const result = await this.customerRepository.deleteAllCustomers();
    logger.info(`All customers deleted. Total deleted: ${result.deletedCount}`);
    return result;
  }

  private toResponseDto(customer: ICustomer): CustomerResponseDto {
    return {
      id: customer.id,
      fullName: customer.fullName,
      phoneNumber: customer.phoneNumber,
      guarantorName: customer.guarantorName,
      guarantorPhone: customer.guarantorPhone,
      dueDate: customer.dueDate,
      importedOverdueDays: customer.importedOverdueDays,
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
   * Used by the daily scheduler.
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
