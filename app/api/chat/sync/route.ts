import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const lastFetchedAt = searchParams.get("lastFetchedAt"); // ISO string

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    // 2. Validate membership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const isParticipant = conversation.participants.some((p) => p.userId === session.user.id);
    const isAdmin = session.user.role === Role.ADMIN;

    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();

    // 3. Update current user's lastActiveAt to track online status
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: now },
    }).catch(err => console.error("Sync error updating lastActiveAt:", err));

    // 4. Parallel queries for syncing
    // Query typing users in last 5 seconds (excluding current user)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    
    const newMessagesQuery: Prisma.MessageWhereInput = {
      conversationId,
    };
    if (lastFetchedAt) {
      newMessagesQuery.createdAt = {
        gt: new Date(lastFetchedAt),
      };
    }

    const [messages, typingLogs, participantsData] = await Promise.all([
      prisma.message.findMany({
        where: newMessagesQuery,
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.conversationTyping.findMany({
        where: {
          conversationId,
          userId: { not: session.user.id },
          updatedAt: { gte: fiveSecondsAgo },
        },
      }),
      prisma.conversationParticipant.findMany({
        where: { conversationId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              lastActiveAt: true,
            },
          },
        },
      }),
    ]);

    // Format typing indicators list
    const typingUserIds = typingLogs.map((log) => log.userId);

    // Format other participants details
    const otherParticipants = participantsData
      .filter((p) => p.userId !== session.user.id)
      .map((p) => {
        const lastActive = p.user.lastActiveAt;
        const isOnline = lastActive ? (now.getTime() - lastActive.getTime() < 30000) : false; // 30 seconds online buffer
        return {
          id: p.userId,
          name: p.user.name,
          lastReadAt: p.lastReadAt,
          isOnline,
        };
      });

    return NextResponse.json({
      success: true,
      messages,
      typingUserIds,
      otherParticipants,
      isSuspended: conversation.isSuspended,
      suspendedReason: conversation.suspendedReason,
      isReported: conversation.isReported,
      syncTime: now.toISOString(),
    });
  } catch (error) {
    console.error("Chat sync API error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
