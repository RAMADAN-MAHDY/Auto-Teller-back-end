import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { parseExcelDate, normalizeArabicNumerals, normalizePhoneNumber, detectExcelColumns } from './src/common/utils';
import { importCustomerSchema } from './src/modules/customers/import-customer.dto';

async function test() {
  const buffer = fs.readFileSync('Test 3 30082026.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  const headerRow = worksheet.getRow(1);
  const colMap = detectExcelColumns(headerRow);

  console.log('Columns detected:', colMap);

  const jsonData = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const fullName = row.getCell(colMap.fullName).value?.toString()?.trim() || '';
    const phoneNumber = normalizePhoneNumber(row.getCell(colMap.phoneNumber).value);
    if (!fullName && !phoneNumber) return;

    const parsedDueDate = parseExcelDate(row.getCell(colMap.dueDate).value);
    const parsedDtOfOpen = colMap.dtOfOpen
      ? parseExcelDate(row.getCell(colMap.dtOfOpen).value)
      : null;

    const rawOverdue = colMap.importedOverdueDays
      ? row.getCell(colMap.importedOverdueDays).value
      : undefined;
    const parsedOverdue =
      rawOverdue !== undefined && rawOverdue !== null && rawOverdue !== ''
        ? Number(normalizeArabicNumerals(rawOverdue))
        : 0;

    const rowData = {
      fullName,
      phoneNumber,
      guarantorName: colMap.guarantorName ? row.getCell(colMap.guarantorName).value?.toString()?.trim() || undefined : undefined,
      guarantorPhone: colMap.guarantorPhone ? normalizePhoneNumber(row.getCell(colMap.guarantorPhone).value) || undefined : undefined,
      dueDate: parsedDueDate ? parsedDueDate.toISOString() : '',
      dtOfOpen: parsedDtOfOpen ? parsedDtOfOpen.toISOString() : '',
      importedOverdueDays: !isNaN(parsedOverdue) ? parsedOverdue : 0,
    };

    const validatedRow = importCustomerSchema.parse(rowData);
    jsonData.push(validatedRow);
  });

  console.log('Successfully validated all rows! Total count:', jsonData.length);
  jsonData.forEach((r, idx) => console.log(`[${idx + 1}] Name: ${r.fullName} | Phone: ${r.phoneNumber} | DueDate: ${r.dueDate} | DT_OF_OPEN: ${r.dtOfOpen} | OverdueDays: ${r.importedOverdueDays}`));
}

test().catch(console.error);
