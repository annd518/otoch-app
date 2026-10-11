// Reports early red flag blocks to the server and retries the ones the server
// has not confirmed (after a network error, an app restart or a re-login).
import { apiService } from './api'
import type { BlockServerState, PendingBlockAnswers } from './bookingDraft'
import { storage } from '../utils/storage'
import { pendingBlocks } from '../utils/pendingBlocks'

export async function reportBlockInBackground(
  orderId: string,
  report: PendingBlockAnswers,
  source: 'real' | 'mock',
  onResult: (server: BlockServerState, version: number | null) => void,
): Promise<void> {
  const user = await storage.getUser()
  if (user) await pendingBlocks.save({ userId: user.id, orderId, source, ...report })
  const result = await apiService.reportRedFlagBlock(orderId, report.answers, report.questionnaires)
  if (result.kind === 'recorded') {
    if (user) await pendingBlocks.remove(user.id, orderId)
    onResult('recorded', result.version)
  } else {
    onResult(result.kind === 'not_supported' ? 'not_supported' : 'pending', null)
  }
}

// Retries every unconfirmed block of the signed-in user. Returns the order ids
// that are still not confirmed by the server.
export async function syncPendingBlocks(): Promise<string[]> {
  const user = await storage.getUser()
  if (!user) return []
  const open: string[] = []
  for (const block of await pendingBlocks.list(user.id)) {
    const order = await apiService.getOrder(block.orderId)
    if (order.ok && (order.data.status === 'BLOCKED_RED_FLAG' || order.data.redFlagStatus === 'FLAGGED')) {
      await pendingBlocks.remove(user.id, block.orderId)
      continue
    }
    if (!order.ok && order.code === 'ORDER_NOT_FOUND') {
      // The order no longer exists (or was a development mock lost on restart).
      await pendingBlocks.remove(user.id, block.orderId)
      continue
    }
    const result = await apiService.reportRedFlagBlock(block.orderId, block.answers, block.questionnaires)
    if (result.kind === 'recorded') await pendingBlocks.remove(user.id, block.orderId)
    else open.push(block.orderId)
  }
  return open
}
