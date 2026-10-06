/**
 * Mock Email Service for Local Development
 * Prints stylized email headers and formatted template context directly to the console.
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  templateName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, any>
) {
  const border = "=".repeat(60);
  const time = new Date().toLocaleString("en-IN");
  
  console.log(`
${border}
✉️  MOCK EMAIL SENT AT: ${time}
------------------------------------------------------------
TO:      ${to}
SUBJECT: ${subject}
TEMPLATE: ${templateName}
------------------------------------------------------------
CONTEXT DATA:
${JSON.stringify(context, null, 2)}

[HTML PREVIEW DESCRIPTIONS]:
${getEmailPreviewDescription(templateName, context)}
${border}
  `);

  return { success: true, messageId: `mock-${Date.now()}` };
}

/**
 * Returns a brief human-readable breakdown of the mock HTML email content.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEmailPreviewDescription(template: string, ctx: Record<string, any>): string {
  switch (template) {
    case "CUSTOMER_ORDER_PLACED":
      return `Dear Customer (${ctx.customerName}),
Your order #${ctx.orderNumber} containing ${ctx.itemCount} items from seller "${ctx.sellerStoreName}" has been successfully placed.
Grand Total: ₹${ctx.totalAmount}.
Payment Method: ${ctx.paymentMethod}. Status: PENDING.`;

    case "CUSTOMER_PAYMENT_SUCCESS":
      return `Dear Customer (${ctx.customerName}),
We have received payment of ₹${ctx.amount} for Order #${ctx.orderNumber}.
Transaction ID: ${ctx.transactionId}. Payment status has been marked as PAID.`;

    case "CUSTOMER_PAYMENT_FAILED":
      return `Dear Customer (${ctx.customerName}),
Your payment attempt of ₹${ctx.amount} for Order #${ctx.orderNumber} has FAILED.
Please try checking out again or contact support. Reference ID: ${ctx.paymentReference || "N/A"}.`;

    case "CUSTOMER_ORDER_SHIPPED":
      return `Dear Customer (${ctx.customerName}),
Good news! Your order #${ctx.orderNumber} from seller "${ctx.sellerStoreName}" has been shipped.
Courier: ${ctx.courierName}
Tracking ID: ${ctx.trackingNumber}
Tracking Link: ${ctx.trackingUrl || "N/A"}
Estimated Delivery: ${ctx.estimatedDeliveryDate || "3-5 business days"}.`;

    case "CUSTOMER_ORDER_DELIVERED":
      return `Dear Customer (${ctx.customerName}),
Your order #${ctx.orderNumber} from seller "${ctx.sellerStoreName}" has been successfully DELIVERED.
Thank you for shopping with GarmentHub!`;

    case "SELLER_NEW_ORDER":
      return `Dear Seller (${ctx.sellerName}),
You have received a new order #${ctx.orderNumber} for your store "${ctx.storeName}".
Order Items Total: ₹${ctx.subtotal}.
Please prepare the items and mark them packed once ready for courier pickup.`;

    case "SELLER_NEW_RFQ":
      return `Dear Seller (${ctx.sellerName}),
A B2B Wholesale Buyer has requested a bulk quotation for your product "${ctx.productName}".
Requested Quantity: ${ctx.quantity} units. Target Price: ₹${ctx.targetPrice}/pc.
Please log in to your dashboard to submit your price quote proposal.`;

    case "SELLER_PRODUCT_APPROVED":
      return `Dear Seller (${ctx.sellerName}),
Congratulations! Your product "${ctx.productName}" has been APPROVED by the administrator and is now ACTIVE in the marketplace catalog.`;

    case "SELLER_PRODUCT_REJECTED":
      return `Dear Seller (${ctx.sellerName}),
Your product submission "${ctx.productName}" was not approved by the administrator.
Rejection Reason: "${ctx.reason}"`;

    case "ADMIN_NEW_SELLER_REQUEST":
      return `Attention Admin,
A new seller application has been submitted by "${ctx.sellerName}" (Store: "${ctx.storeName}").
Please review their registration details and pickup address.`;

    case "ADMIN_NEW_KYC_REQUEST":
      return `Attention Admin,
A new business KYC verification document request has been submitted by ${ctx.profileType} "${ctx.profileName}".
Please inspect their uploaded documents and verify GSTIN/PAN mappings.`;

    case "ADMIN_SUSPICIOUS_KYC_ALERT":
      return `⚠️ WARNING: Admin Compliance Alert
Business KYC submitted by ${ctx.profileType} "${ctx.profileName}" has triggered suspicious validation warnings.
Flagged warnings: ${ctx.warnings?.join(", ") || "None"}.
Please review compliance details immediately.`;

    case "ADMIN_NEW_B2B_REQUEST":
      return `Attention Admin,
A new B2B Wholesale Buyer access application has been submitted by "${ctx.companyName}".
Please review their profile and approve B2B catalog access.`;

    case "SELLER_NEW_REVIEW":
      return `Dear Seller (${ctx.sellerName}),
A customer has left a ${ctx.rating}-star review for your product "${ctx.productName}".
Title: "${ctx.reviewTitle}"
Comment: "${ctx.reviewComment}"`;

    case "CUSTOMER_REVIEW_REPLY":
      return `Dear Customer (${ctx.customerName}),
The seller has replied to your review on "${ctx.productName}".
Reply: "${ctx.replyText}"`;

    case "SELLER_NEW_QUESTION":
      return `Dear Seller (${ctx.sellerName}),
A customer has asked a question about your product "${ctx.productName}".
Question: "${ctx.questionText}"`;

    case "CUSTOMER_QUESTION_ANSWERED":
      return `Dear Customer (${ctx.customerName}),
The seller has answered your question about "${ctx.productName}".
Question: "${ctx.questionText}"
Answer: "${ctx.answerText}"`;

    default:
      return `Template preview not configured. Context: ${JSON.stringify(ctx)}`;
  }
}
