"use server";

/**
 * Placeholder for future Razorpay order creation.
 */
export async function createOnlinePayment(amount: number, receiptId: string) {
  console.log(`[PaymentService] Mock createOnlinePayment called for amount: ${amount}, receipt: ${receiptId}`);
  // In the future, this would integrate with Razorpay:
  // const order = await razorpay.orders.create({ amount, currency: "INR", receipt: receiptId });
  // return order;
  throw new Error("Razorpay online payment creation is not implemented yet. Use COD or Manual payment.");
}

/**
 * Placeholder for future Razorpay payment verification.
 */

export async function verifyOnlinePayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _razorpaySignature: string
) {
  console.log(`[PaymentService] Mock verifyOnlinePayment called for order: ${razorpayOrderId}, payment: ${razorpayPaymentId}`);
  throw new Error("Razorpay online payment verification is not implemented yet.");
}

/**
 * Placeholder for future Webhook verification and handling.
 */
export async function handlePaymentWebhook(event: unknown) {
  console.log("[PaymentService] Mock handlePaymentWebhook called", event);
  throw new Error("Razorpay webhook handler is not implemented yet.");
}
