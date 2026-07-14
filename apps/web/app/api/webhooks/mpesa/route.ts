import { parseMpesaCallback, type MpesaCallbackPayload } from '@/lib/payments/mpesa';
import { createRepositories } from '@repo/database';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let payload: MpesaCallbackPayload;
  try {
    payload = (await request.json()) as MpesaCallbackPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const result = parseMpesaCallback(payload);
  if (!result) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const repos = createRepositories();
  const payment = await repos.payment.findByExternalId(result.checkoutRequestId);

  if (!payment) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (result.success) {
    await repos.payment.completePayment(payment.id, result.receipt ?? result.checkoutRequestId, {
      mpesaReceipt: result.receipt,
      resultDesc: result.resultDesc,
    });
  } else {
    await repos.payment.markFailed(payment.id, {
      resultDesc: result.resultDesc,
      checkoutRequestId: result.checkoutRequestId,
    });
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}
