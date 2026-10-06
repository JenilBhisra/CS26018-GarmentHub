"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";

/**
 * Get current user's session.
 */
async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Customers ask a question about a product.
 */
export async function askQuestion(productId: string, questionText: string) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Please sign in to ask questions" };
  }

  const trimmedText = questionText.trim();
  if (!trimmedText) {
    return { success: false, error: "Question cannot be empty" };
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { seller: { include: { user: true } } },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    const question = await prisma.productQuestion.create({
      data: {
        userId: user.id,
        productId,
        question: trimmedText,
      },
    });

    // Notify seller
    if (product.seller) {
      const sellerUserId = product.seller.userId;
      await sendInAppNotification(
        sellerUserId,
        NotificationType.QUESTION_RECEIVED,
        "New Product Question Received",
        `A customer asked about "${product.name}": "${trimmedText}"`,
        `/seller/qa`
      );

      await sendNotificationEmail(
        product.seller.user.email,
        `New Product Question: ${product.name}`,
        "SELLER_NEW_QUESTION",
        {
          sellerName: product.seller.user.name,
          productName: product.name,
          questionText: trimmedText,
        }
      );
    }

    revalidatePath(`/product/${productId}`);
    revalidatePath("/seller/qa");

    return { success: true, questionId: question.id };
  } catch (error: unknown) {
    console.error("askQuestion error:", error);
    return { success: false, error: "Failed to post question" };
  }
}

/**
 * Sellers submit or update an answer to a question.
 */
export async function answerQuestion(
  questionId: string,
  answerId: string | null,
  answerText: string
) {
  const user = await getSessionUser();
  if (!user || user.role !== "SELLER") {
    return { success: false, error: "Seller access required" };
  }

  const trimmedAnswer = answerText.trim();
  if (!trimmedAnswer) {
    return { success: false, error: "Answer cannot be empty" };
  }

  try {
    const question = await prisma.productQuestion.findUnique({
      where: { id: questionId },
      include: { product: true, user: true },
    });

    if (!question) {
      return { success: false, error: "Question not found" };
    }

    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!sellerProfile || question.product.sellerId !== sellerProfile.id) {
      return { success: false, error: "Forbidden: You do not own this product." };
    }

    let answer;
    if (answerId) {
      // EDIT ANSWER MODE
      const existingAnswer = await prisma.productAnswer.findUnique({
        where: { id: answerId },
      });

      if (!existingAnswer || existingAnswer.sellerId !== sellerProfile.id) {
        return { success: false, error: "Answer not found or unauthorized" };
      }

      answer = await prisma.productAnswer.update({
        where: { id: answerId },
        data: {
          answer: trimmedAnswer,
        },
      });
    } else {
      // CREATE ANSWER MODE
      answer = await prisma.productAnswer.create({
        data: {
          questionId,
          sellerId: sellerProfile.id,
          answer: trimmedAnswer,
        },
      });
    }

    // Notify customer
    await sendInAppNotification(
      question.userId,
      NotificationType.QUESTION_ANSWERED,
      "Your Question was Answered",
      `The seller answered your question about "${question.product.name}": "${trimmedAnswer}"`,
      `/product/${question.productId}`
    );

    await sendNotificationEmail(
      question.user.email,
      `Your Question about ${question.product.name} has been Answered`,
      "CUSTOMER_QUESTION_ANSWERED",
      {
        customerName: question.user.name,
        productName: question.product.name,
        questionText: question.question,
        answerText: trimmedAnswer,
      }
    );

    revalidatePath(`/product/${question.productId}`);
    revalidatePath("/seller/qa");

    return { success: true, answerId: answer.id };
  } catch (error: unknown) {
    console.error("answerQuestion error:", error);
    return { success: false, error: "Failed to save answer" };
  }
}

/**
 * Admin moderates questions (hides/unhides questions).
 */
export async function moderateQuestion(questionId: string, isHidden: boolean) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" };
  }

  try {
    const question = await prisma.productQuestion.update({
      where: { id: questionId },
      data: { isHidden },
    });

    revalidatePath(`/product/${question.productId}`);
    revalidatePath("/admin/qa");

    return { success: true };
  } catch (error: unknown) {
    console.error("moderateQuestion error:", error);
    return { success: false, error: "Failed to moderate question" };
  }
}

/**
 * Admin deletes an inappropriate answer.
 */
export async function deleteAnswerAdmin(answerId: string) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" };
  }

  try {
    const answer = await prisma.productAnswer.findUnique({
      where: { id: answerId },
      include: { question: true },
    });

    if (!answer) {
      return { success: false, error: "Answer not found" };
    }

    await prisma.productAnswer.delete({
      where: { id: answerId },
    });

    revalidatePath(`/product/${answer.question.productId}`);
    revalidatePath("/admin/qa");

    return { success: true };
  } catch (error: unknown) {
    console.error("deleteAnswerAdmin error:", error);
    return { success: false, error: "Failed to delete answer" };
  }
}

/**
 * Fetch public Q&As for a product.
 */
export async function getQuestions(productId: string) {
  try {
    const questions = await prisma.productQuestion.findMany({
      where: { productId, isHidden: false },
      include: {
        user: { select: { name: true } },
        answers: {
          include: {
            seller: {
              select: {
                storeName: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, questions };
  } catch (error) {
    console.error("getQuestions error:", error);
    return { success: false, error: "Failed to fetch questions" };
  }
}
