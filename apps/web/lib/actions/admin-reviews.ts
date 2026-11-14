'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';

const repos = createRepositories();

export type ReviewActionState = { success: boolean; error?: string };

/** Wrap a moderation call so failures surface as state, not a thrown promise. */
async function run(operation: () => Promise<unknown>, failure: string): Promise<ReviewActionState> {
  try {
    await operation();
    revalidatePath('/admin/reviews');
    return { success: true };
  } catch (error) {
    console.error(failure, error);
    return { success: false, error: failure };
  }
}

export async function approveReviewAction(id: string): Promise<ReviewActionState> {
  await requirePermission('reviews.write');
  return run(() => repos.review.approve(id), 'Could not approve that review.');
}

export async function rejectReviewAction(id: string): Promise<ReviewActionState> {
  await requirePermission('reviews.write');
  return run(() => repos.review.reject(id), 'Could not reject that review.');
}

export async function pinReviewAction(id: string, isPinned: boolean): Promise<ReviewActionState> {
  await requirePermission('reviews.write');
  return run(
    () => (isPinned ? repos.review.pin(id) : repos.review.unpin(id)),
    'Could not update that review.'
  );
}

export async function replyToReviewAction(id: string, reply: string): Promise<ReviewActionState> {
  await requirePermission('reviews.write');
  const trimmed = reply.trim();
  if (!trimmed) {
    return { success: false, error: 'Write a reply before saving.' };
  }
  if (trimmed.length > 2000) {
    return { success: false, error: 'Keep the reply under 2000 characters.' };
  }
  return run(() => repos.review.reply(id, trimmed), 'Could not save that reply.');
}

export async function deleteReviewAction(id: string): Promise<ReviewActionState> {
  await requirePermission('reviews.delete');
  return run(() => repos.review.delete(id), 'Could not delete that review.');
}