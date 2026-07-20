import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './customer.dto';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils';
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '../../common/exceptions';
import { ImportCustomerDto, importCustomerSchema } from './import-customer.dto';

@Service()
export class CustomerController {
  private readonly customerService = Container.get(CustomerService);

  create = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as CreateCustomerDto;
    const customer = await this.customerService.create(dto);
    sendCreated(res, customer, 'Customer created successfully');
  };

  import = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer as any);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new BadRequestException('No worksheet found in the Excel file');
      }

      const jsonData: ImportCustomerDto[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const rowData: any = {};
        rowData.fullName = row.getCell(1).value?.toString() || '';
        rowData.phoneNumber = row.getCell(2).value?.toString() || '';
        rowData.guarantorName = row.getCell(3).value?.toString() || '';
        rowData.guarantorPhone = row.getCell(4).value?.toString() || '';
        rowData.dueDate = row.getCell(5).value ? new Date(row.getCell(5).value as any).toISOString() : '';
        rowData.importedOverdueDays = row.getCell(6).value ? Number(row.getCell(6).value) : 0;
        // Add other fields as needed, mapping Excel columns to DTO fields
        // For example, if notes is column 7, tags is column 8
        // rowData.notes = row.getCell(7).value?.toString() || '';
        // rowData.tags = row.getCell(8).value?.toString() || '';

        try {
          const validatedRow = importCustomerSchema.parse(rowData);
          jsonData.push(validatedRow);
        } catch (validationError: any) {
          throw new BadRequestException(`Validation error on row ${rowNumber}: ${validationError.errors.map((err: any) => err.message).join(', ')}`);
        }
      });

      const result = await this.customerService.importCustomers(jsonData);
      sendSuccess(res, result, 'Customer import process completed');
    } catch (error: any) {
      throw new BadRequestException(`Error processing file: ${error.message}`);
    }
  };

  findAll = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as CustomerQueryDto;
    const result = await this.customerService.findAll(query);
    sendSuccess(res, result.data, 'Customers retrieved successfully', 200, result.meta);
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const customer = await this.customerService.findById(req.params.id as string);
    sendSuccess(res, customer, 'Customer retrieved successfully');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as UpdateCustomerDto;
    const customer = await this.customerService.update(req.params.id as string, dto);
    sendSuccess(res, customer, 'Customer updated successfully');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.customerService.delete(req.params.id as string);
    sendNoContent(res);
  };

  deleteAll = async (req: Request, res: Response): Promise<void> => {
    const result = await this.customerService.deleteAll();
    sendSuccess(res, result, 'All customers deleted successfully');
  };
}
