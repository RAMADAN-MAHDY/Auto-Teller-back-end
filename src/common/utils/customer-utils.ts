import { differenceInDays } from 'date-fns';
import { CustomerGroup } from '../constants';

export function calculateCustomerGroupFromImportedOverdueDays(overdueDays: number): CustomerGroup {
  if (overdueDays <= 0) {
    return CustomerGroup.COMPLIANT;
  }

  if (overdueDays >= 1 && overdueDays <= 30) {
    return CustomerGroup.LATE;
  }

  if (overdueDays >= 31 && overdueDays <= 90) {
    return CustomerGroup.DEFAULTED;
  }

  return CustomerGroup.TRANSFERRED;
}

export function calculateCustomerGroupAndOverdueDays(dueDate: Date, importedOverdueDays = 0): { overdueDays: number; customerGroup: CustomerGroup } {
  const overdueDays = importedOverdueDays;
  return {
    overdueDays,
    customerGroup: calculateCustomerGroupFromImportedOverdueDays(overdueDays),
  };
}
