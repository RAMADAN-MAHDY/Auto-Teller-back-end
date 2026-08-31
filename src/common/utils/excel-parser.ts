import { Row } from 'exceljs';

/**
 * Normalizes Eastern Arabic (٠-٩) and Persian (۰-۹) numerals to Western digits (0-9).
 */
export function normalizeArabicNumerals(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
}

/**
 * Normalizes phone numbers:
 * - Converts Arabic numerals to standard digits
 * - Strips whitespace and special formatting characters
 * - Keeps leading + if present
 * - Automatically prepends leading 0 for 10-digit Egyptian mobile numbers (e.g. 10xxxxxxxx -> 010xxxxxxxx)
 */
export function normalizePhoneNumber(value: unknown): string {
  if (!value) return '';

  let str = normalizeArabicNumerals(value)
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim();

  const hasPlus = str.startsWith('+');
  str = str.replace(/[^\d]/g, '');

  if (hasPlus) {
    str = '+' + str;
  } else if (/^1[0125]\d{8}$/.test(str)) {
    // Egyptian mobile number missing leading 0
    str = '0' + str;
  }

  return str;
}

/**
 * Parses diverse Excel date formats into a valid Date object:
 * - Native Date objects from ExcelJS
 * - Excel date serial numbers (e.g. 45534)
 * - Strings in DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO formats
 * - Dates with Eastern Arabic numerals (e.g. ١٤/٠٩/٢٠٢٥)
 * - Formula / RichText cell objects from ExcelJS
 */
export function parseExcelDate(value: unknown): Date | null {
  if (!value) return null;

  // 1. Native Date instance
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // 2. ExcelJS complex cell objects (Formula / RichText)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.date instanceof Date && !isNaN(obj.date.getTime())) {
      return obj.date;
    }
    if (obj.result !== undefined) {
      return parseExcelDate(obj.result);
    }
    if (obj.text !== undefined) {
      return parseExcelDate(obj.text);
    }
  }

  // 3. Excel serial number (days since 1899-12-30)
  if (typeof value === 'number') {
    if (value > 0) {
      // Excel epoch adjustment (25569 = 1970-01-01 in Excel epoch)
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // 4. String parsing
  if (typeof value === 'string' || typeof value === 'number') {
    let str = normalizeArabicNumerals(value)
      .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '')
      .trim();

    if (!str) return null;

    // Pattern: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dmyMatch) {
      let day = parseInt(dmyMatch[1], 10);
      let month = parseInt(dmyMatch[2], 10);
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;

      // Handle cases where month and day might be inverted (month > 12)
      if (month > 12 && day <= 12) {
        const temp = day;
        day = month;
        month = temp;
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const parsedDate = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(parsedDate.getTime())) return parsedDate;
      }
    }

    // Pattern: YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
    const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const parsedDate = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(parsedDate.getTime())) return parsedDate;
      }
    }

    // Fallback standard Date parse
    const fallbackDate = new Date(str);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
  }

  return null;
}

export interface ExcelColumnMapping {
  fullName: number;
  phoneNumber: number;
  guarantorName?: number;
  guarantorPhone?: number;
  dueDate: number;
  importedOverdueDays?: number;
  notes?: number;
  tags?: number;
}

/**
 * Dynamically detects column positions by analyzing header cell labels
 * in both Arabic and English. Falls back to default column order if headers aren't detected.
 */
export function detectExcelColumns(headerRow: Row): ExcelColumnMapping {
  const mapping: Partial<ExcelColumnMapping> = {};
  let phoneCount = 0;

  headerRow.eachCell((cell, colNumber) => {
    const rawVal = (cell.value?.toString() || '').trim().toLowerCase().replace(/\s+/g, ' ');

    if (/اسم.*عميل|اسم.*العميل|^الاسم$|^اسم$|full.*name|customer.*name|client.*name|^name$/.test(rawVal)) {
      mapping.fullName = colNumber;
    } else if (/اسم.*ضامن|اسم.*الضامن|^ضامن$|^الضامن$|guarantor.*name|^guarantor$/.test(rawVal)) {
      mapping.guarantorName = colNumber;
    } else if (/ضامن.*(تليفون|هاتف|موبايل)|guarantor.*phone|guarantor.*mobile/.test(rawVal)) {
      mapping.guarantorPhone = colNumber;
    } else if (/تليفون|هاتف|موبايل|phone|mobile|cell/.test(rawVal)) {
      phoneCount++;
      if (phoneCount === 1) {
        mapping.phoneNumber = colNumber;
      } else if (phoneCount === 2 && !mapping.guarantorPhone) {
        mapping.guarantorPhone = colNumber;
      }
    } else if (/استحقاق|due.*date|maturity/.test(rawVal)) {
      mapping.dueDate = colNumber;
    } else if (/تأخير|تاخير|overdue/.test(rawVal)) {
      mapping.importedOverdueDays = colNumber;
    } else if (/ملاحظ|notes|comment/.test(rawVal)) {
      mapping.notes = colNumber;
    } else if (/تصنيف|وسم|tags|tag|categor/.test(rawVal)) {
      mapping.tags = colNumber;
    }
  });

  // Default fallback positions if not resolved from headers
  return {
    fullName: mapping.fullName || 1,
    phoneNumber: mapping.phoneNumber || 2,
    guarantorName: mapping.guarantorName || 3,
    guarantorPhone: mapping.guarantorPhone || 4,
    dueDate: mapping.dueDate || 5,
    importedOverdueDays: mapping.importedOverdueDays || 6,
    notes: mapping.notes,
    tags: mapping.tags,
  };
}
