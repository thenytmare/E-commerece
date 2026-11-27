'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';

const repos = createRepositories();

const STAFF_ACCOUNT_MESSAGE =
  'This is a staff account. Remove their staff access first, under Settings, then Staff & roles.';

export async function softDeleteCustomerAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('customers.delete');
  try {
    // Customer tools must not switch off a staff account. That would let a
    // shop manager lock out an admin.
    if ((await repos.user.staffIdsAmong([id])).length > 0) {
      return { success: false, error: STAFF_ACCOUNT_MESSAGE };
    }
    await repos.user.softDelete(id);
    revalidatePath('/admin/customers');
    return { success: true };
  } catch (error) {
    console.error('Failed to deactivate customer:', error);
    return { success: false, error: 'Failed to deactivate customer.' };
  }
}

export async function restoreCustomerAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('customers.write');
  try {
    await repos.user.restore(id);
    revalidatePath('/admin/customers');
    return { success: true };
  } catch (error) {
    console.error('Failed to restore customer:', error);
    return { success: false, error: 'Failed to restore customer.' };
  }
}

export async function bulkActionCustomers(
  ids: string[],
  action: 'soft-delete' | 'restore'
): Promise<{ success: boolean; error?: string; count?: number }> {
  await requirePermission('customers.write');
  try {
    let count = 0;
    switch (action) {
      case 'soft-delete': {
        await requirePermission('customers.delete');
        const staff = await repos.user.staffIdsAmong(ids);
        if (staff.length > 0) {
          return { success: false, error: STAFF_ACCOUNT_MESSAGE };
        }
        count = await repos.user.bulkSoftDelete(ids);
        break;
      }
      case 'restore':
        count = await repos.user.bulkRestore(ids);
        break;
    }
    revalidatePath('/admin/customers');
    return { success: true, count };
  } catch (error) {
    console.error(`Bulk ${action} failed:`, error);
    return { success: false, error: `Bulk ${action} failed.` };
  }
}
