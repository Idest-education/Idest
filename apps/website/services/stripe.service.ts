import { http } from "./http";

interface PaymentIntentResponse {
  isFree?: boolean;
  alreadyOwned?: boolean;
  paymentIntentId?: string;
  clientSecret?: string | null;
}

interface ConfirmPurchaseResponse {
  success: boolean;
  isFree: boolean;
}

export async function createClassPaymentIntent(
  classId: string,
): Promise<PaymentIntentResponse> {
  const res = await http.post(`/stripe/classes/${classId}/payment-intent`);
  return res.data;
}

export async function confirmClassPurchase(
  classId: string,
  paymentIntentId?: string,
): Promise<ConfirmPurchaseResponse> {
  const res = await http.post(`/stripe/classes/${classId}/confirm`, {
    paymentIntentId,
  });
  return res.data;
}


