import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './customer.dto';
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  parseExcelDate,
  normalizeArabicNumerals,
  normalizePhoneNumber,
  detectExcelColumns,
} from '../../common/utils';
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

      const headerRow = worksheet.getRow(1);
      const colMap = detectExcelColumns(headerRow);

      const jsonData: ImportCustomerDto[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const fullName = row.getCell(colMap.fullName).value?.toString()?.trim() || '';
        const phoneNumber = normalizePhoneNumber(row.getCell(colMap.phoneNumber).value);

        // Skip blank rows
        if (!fullName && !phoneNumber) {
          return;
        }

        const parsedDueDate = parseExcelDate(row.getCell(colMap.dueDate).value);
        const guarantorName = colMap.guarantorName
          ? row.getCell(colMap.guarantorName).value?.toString()?.trim() || ''
          : '';
        const guarantorPhone = colMap.guarantorPhone
          ? normalizePhoneNumber(row.getCell(colMap.guarantorPhone).value)
          : '';

        const rawOverdue = colMap.importedOverdueDays
          ? row.getCell(colMap.importedOverdueDays).value
          : undefined;
        const parsedOverdue =
          rawOverdue !== undefined && rawOverdue !== null && rawOverdue !== ''
            ? Number(normalizeArabicNumerals(rawOverdue))
            : 0;

        const rowData: Record<string, any> = {
          fullName,
          phoneNumber,
          guarantorName: guarantorName || undefined,
          guarantorPhone: guarantorPhone || undefined,
          dueDate: parsedDueDate ? parsedDueDate.toISOString() : '',
          importedOverdueDays: !isNaN(parsedOverdue) ? parsedOverdue : 0,
        };

        if (colMap.notes) {
          rowData.notes = row.getCell(colMap.notes).value?.toString()?.trim() || undefined;
        }
        if (colMap.tags) {
          rowData.tags = row.getCell(colMap.tags).value?.toString()?.trim() || undefined;
        }

        try {
          const validatedRow = importCustomerSchema.parse(rowData);
          jsonData.push(validatedRow);
        } catch (validationError: any) {
          const errMsg = validationError.errors
            ? validationError.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ')
            : validationError.message;
          throw new BadRequestException(`Validation error on row ${rowNumber}: ${errMsg}`);
        }
      });

      if (jsonData.length === 0) {
        throw new BadRequestException('The uploaded file does not contain any valid customer rows');
      }

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
