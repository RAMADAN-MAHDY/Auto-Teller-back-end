import { differenceInDays } from 'date-fns';
import { CustomerGroup } from '../constants';

export function calculateCustomerGroupAndOverdueDays(dueDate: Date): { overdueDays: number; customerGroup: CustomerGroup } {
  const today = new Date();
  const overdueDays = differenceInDays(today, dueDate);

  let customerGroup: CustomerGroup;
  if (overdueDays <= 0) {
    customerGroup = CustomerGroup.COMPLIANT;
  } else if (overdueDays >= 1 && overdueDays <= 30) {
    customerGroup = CustomerGroup.LATE;
  } else if (overdueDays >= 31 && overdueDays <= 90) {
    customerGroup = CustomerGroup.DEFAULTED;
  } else {
    customerGroup = CustomerGroup.TRANSFERRED;
  }

  return { overdueDays, customerGroup };
}
