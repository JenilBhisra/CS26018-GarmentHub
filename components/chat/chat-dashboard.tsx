/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Search, Pin, Archive, Trash2, Edit, MessageSquare, Send, Paperclip, 
  AlertTriangle, Image as ImageIcon, FileIcon, ExternalLink, ShieldAlert,
  Check, CheckCheck, Flag, X, Lock, Unlock, User, Sparkles, Smile, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useRealTimeChat } from "@/hooks/use-real-time-chat";
import { 
  getConversations, getMessages, sendMessage, editMessage, 
  deleteMessage, addReaction, removeReaction, togglePin, 
  toggleArchive, markAsRead, reportConversation, moderateConversation,
  updateTypingStatus 
} from "@/actions/chat";

interface ChatDashboardProps {
  role: "CUSTOMER" | "SELLER" | "B2B" | "ADMIN";
}

export default function ChatDashboard({ role }: ChatDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL Params initialization
  const initialConvId = searchParams?.get("id") || null;
  const initialOrderId = searchParams?.get("orderId") || null;
  const initialSellerId = searchParams?.get("sellerId") || null;
  const initialProductId = searchParams?.get("productId") || null;
  const initialSellerSlug = searchParams?.get("sellerSlug") || null;

  // Conversations list states
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId);
  const [searchTerm, setSearchTerm] = useState("");
  const [tabFilter, setTabFilter] = useState<"active" | "pinned" | "archived" | "reported">("active");

  // Selected conversation states
  const [messages, setMessages] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // Input area states
  const [textInput, setTextInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<any | null>(null); // { url, name, size, type }

  // Typing indicators & statuses
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [otherParticipants, setOtherParticipants] = useState<any[]>([]);
  const [moderationState, setModerationState] = useState<{ isSuspended: boolean; suspendedReason: string | null }>({
    isSuspended: false,
    suspendedReason: null,
  });

  // Modal / Interaction UI states
  const [reportReason, setReportReason] = useState("");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmojiPickerId, setShowEmojiPickerId] = useState<string | null>(null);
  
  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Emojis list for reactions
  const EMOJI_LIST = ["👍", "❤️", "😄", "😮", "😢", "😠"];

  // 1. Initial Load of Conversations List
  const loadConversationsList = async (search = searchTerm) => {
    try {
      const list = await getConversations(search);
      setConversations(list);

      // Handle query-based initialization
      if (initialConvId && list.some(c => c.id === initialConvId)) {
        setActiveConvId(initialConvId);
      } else if (initialSellerId || initialSellerSlug) {
        // Trigger get or create conversation
        await handleAutoConversationInit();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load conversations list.");
    }
  };

  // 2. Auto-initialize conversation from URL context (e.g. Inquire about product / Order Support)
  const handleAutoConversationInit = async () => {
    try {
      const { getOrCreateConversation } = await import("@/actions/chat");
      let type: any = "CUSTOMER_SELLER";
      let targetId = initialSellerId || "";

      if (initialOrderId) {
        type = "ORDER_SUPPORT";
      } else if (role === "B2B") {
        type = "B2B_RFQ";
      }

      // If resolving store slug
      if (initialSellerSlug && !initialSellerId) {
        targetId = initialSellerSlug; // Resolved server-side
      }

      if (!targetId && !initialSellerSlug) return;

      const conv = await getOrCreateConversation(
        type, 
        targetId, 
        initialProductId || undefined, 
        initialOrderId || undefined
      );

      // Clear query params to prevent re-creation loops
      router.replace(window.location.pathname + `?id=${conv.id}`);
      setActiveConvId(conv.id);
      loadConversationsList("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to initialize conversation.");
    }
  };

  useEffect(() => {
    loadConversationsList();
  }, [searchTerm]);

  // Load message logs on conversation active change
  const loadMessageLogs = async (convId: string, pageNum = 1, append = false) => {
    try {
      const logs = await getMessages(convId, pageNum);
      if (append) {
        setMessages(prev => [...logs, ...prev]);
      } else {
        setMessages(logs);
        scrollToBottom();
      }
      setHasMoreMessages(logs.length >= 40);
      setMessagePage(pageNum);

      // Fetch conversation metadata
      const current = conversations.find(c => c.id === convId);
      if (current) {
        setActiveConv(current);
        setModerationState({
          isSuspended: current.isSuspended,
          suspendedReason: current.suspendedReason,
        });
        setOtherParticipants(current.otherParticipants);
      }

      // Mark read receipt
      await markAsRead(convId);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load messages.");
    }
  };

  useEffect(() => {
    if (activeConvId) {
      loadMessageLogs(activeConvId, 1, false);
    } else {
      setMessages([]);
      setActiveConv(null);
    }
  }, [activeConvId, conversations]);

  // Setup real-time listener hook
  const { triggerSync } = useRealTimeChat({
    conversationId: activeConvId,
    onNewMessages: (newMsgs) => {
      // Avoid duplicate append
      setMessages(prev => {
        const unique = [...prev];
        newMsgs.forEach(m => {
          if (!unique.some(existing => existing.id === m.id)) {
            unique.push(m);
          }
        });
        return unique;
      });
      scrollToBottom();
      markAsRead(activeConvId!);
    },
    onTypingChange: (typingIds) => {
      setTypingUsers(typingIds);
    },
    onParticipantsSync: (participants) => {
      setOtherParticipants(participants);
    },
    onModerationSync: (mod) => {
      setModerationState(mod);
    }
  });


  // Keyboard typing indicator trigger
  const handleTypingEvent = () => {
    if (!activeConvId) return;

    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(activeConvId, true);
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(activeConvId, false);
    }, 3000);
  };

  // ---------------------------------------------------------------------------
  // Attachment Upload Handler
  // ---------------------------------------------------------------------------
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: image max 10MB, document max 25MB
    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(isImage ? "Image cannot exceed 10MB limit." : "Document cannot exceed 25MB limit.");
      return;
    }

    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      
      const res = await fetch("/api/chat/upload", {
        method: "POST",
        body: payload,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await res.json();
      setAttachment({
        url: result.url,
        name: result.name,
        size: result.size,
        type: file.type,
      });
      toast.success(`${file.name} uploaded successfully!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  // Send Message Submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId) return;
    if (!textInput.trim() && !attachment) return;

    try {
      let type: any = "TEXT";
      if (attachment) {
        type = attachment.type.startsWith("image/") ? "IMAGE" : "FILE";
      }

      const newMsg = await sendMessage(
        activeConvId,
        textInput,
        type,
        attachment?.url || undefined,
        attachment?.name || undefined,
        attachment?.size || undefined
      );

      // Append locally
      setMessages(prev => [...prev, newMsg]);
      setTextInput("");
      setAttachment(null);
      scrollToBottom();
      
      // Stop typing status immediately
      setIsTyping(false);
      updateTypingStatus(activeConvId, false);
      
      // Refresh list metadata
      loadConversationsList();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send message.");
    }
  };

  // Soft Delete Own Message
  const handleDelete = async (msgId: string) => {
    try {
      await deleteMessage(msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, message: "This message was deleted.", attachmentUrl: null } : m));
      toast.success("Message deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete message.");
    }
  };

  // Edit Own Message
  const handleStartEdit = (msg: any) => {
    setEditingMessageId(msg.id);
    setEditText(msg.message);
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editText.trim()) return;
    try {
      await editMessage(msgId, editText);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isEdited: true, message: editText } : m));
      setEditingMessageId(null);
      setEditText("");
      toast.success("Message updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update message.");
    }
  };

  // Emoji Reactions
  const handleReactionClick = async (msgId: string, emoji: string) => {
    setShowEmojiPickerId(null);
    try {
      // Check if user already reacted with this emoji
      const msg = messages.find(m => m.id === msgId);
      const existing = msg?.reactions?.find((r: any) => r.userId === activeConv?.userId && r.emoji === emoji);

      if (existing) {
        await removeReaction(msgId, emoji);
        setMessages(prev => prev.map(m => {
          if (m.id !== msgId) return m;
          return {
            ...m,
            reactions: m.reactions.filter((r: any) => !(r.userId === activeConv?.userId && r.emoji === emoji))
          };
        }));
      } else {
        await addReaction(msgId, emoji);
        setMessages(prev => prev.map(m => {
          if (m.id !== msgId) return m;
          return {
            ...m,
            reactions: [...m.reactions, { messageId: msgId, emoji, user: { name: "You" } }]
          };
        }));
      }
    } catch (err: any) {
      toast.error(err.message || "Reaction failed.");
    }
  };

  // Pinned/Archived toggle client actions
  const handleTogglePin = async (convId: string, currentPin: boolean) => {
    try {
      await togglePin(convId, !currentPin);
      toast.success(!currentPin ? "Conversation pinned." : "Conversation unpinned.");
      loadConversationsList();
    } catch (err) {
      toast.error("Failed to pin conversation.");
    }
  };

  const handleToggleArchive = async (convId: string, currentArchive: boolean) => {
    try {
      await toggleArchive(convId, !currentArchive);
      toast.success(!currentArchive ? "Conversation archived." : "Conversation unarchived.");
      loadConversationsList();
    } catch (err) {
      toast.error("Failed to archive conversation.");
    }
  };

  // Report Conversation Submit
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !reportReason.trim()) return;

    try {
      await reportConversation(activeConvId, reportReason);
      setIsReportModalOpen(false);
      setReportReason("");
      toast.success("Conversation reported to administrators.");
      loadConversationsList();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report.");
    }
  };

  // Admin Suspension Controls
  const handleAdminSuspend = async (convId: string, action: "SUSPEND" | "UNSUSPEND") => {
    try {
      const reason = action === "SUSPEND" ? "Suspended due to compliance policy review" : undefined;
      await moderateConversation(convId, action, reason);
      toast.success(action === "SUSPEND" ? "Conversation suspended." : "Conversation unsuspended.");
      loadConversationsList();
    } catch (err: any) {
      toast.error(err.message || "Action failed.");
    }
  };

  // Filter conversations list on tab change
  const filteredConversations = conversations.filter(c => {
    if (tabFilter === "pinned") return c.isPinned;
    if (tabFilter === "archived") return c.isArchived;
    if (tabFilter === "reported") return c.isReported;
    // Default active tab: don't show archived/pinned
    return !c.isArchived && !c.isPinned;
  });

  return (
    <div className="flex border border-stone-200 bg-white rounded-2xl shadow-sm h-[78vh] overflow-hidden">
      
      {/* 1. Conversations Sidebar list */}
      <aside className="w-80 border-r border-stone-200 flex flex-col h-full bg-stone-50/50 shrink-0">
        
        {/* Search Header */}
        <div className="p-4 border-b border-stone-150 space-y-3">
          <h2 className="font-display text-lg font-light text-stone-900">Message Box</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search chat or sender..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-4 py-2 text-xs outline-none focus:border-stone-400 shadow-sm"
            />
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex text-[10px] font-bold uppercase tracking-wider border-b border-stone-150 text-stone-500 p-1 bg-stone-100/50">
          {[
            { id: "active", label: "Inbox" },
            { id: "pinned", label: "Pinned" },
            { id: "archived", label: "Archived" },
            ...(role === "ADMIN" ? [{ id: "reported", label: "Reported" }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabFilter(tab.id as any)}
              className={`flex-1 py-2 text-center rounded-md transition ${
                tabFilter === tab.id 
                  ? "bg-white text-stone-900 shadow-sm" 
                  : "hover:text-stone-955 hover:bg-white/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List scroll */}
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400 space-y-2">
              <MessageSquare className="h-6 w-6 text-stone-300 mx-auto" />
              <p>No conversations found.</p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const other = c.otherParticipants[0] || { name: "System Support", isOnline: false };
              const isActive = activeConvId === c.id;
              
              return (
                <div 
                  key={c.id} 
                  onClick={() => setActiveConvId(c.id)}
                  className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-stone-50 transition relative group ${
                    isActive ? "bg-stone-100/70" : ""
                  }`}
                >
                  {/* Status Indicator / Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center font-bold text-xs uppercase text-stone-600">
                      {other.name.charAt(0)}
                    </div>
                    {other.isOnline && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                  </div>

                  {/* Content details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-stone-800 truncate pr-2">{other.name}</h4>
                      <span className="text-[9px] text-stone-400 shrink-0">
                        {new Date(c.lastMessageAt).toLocaleDateString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-stone-505 truncate leading-relaxed">
                      {c.lastMessage ? (
                        <>
                          <span className="font-medium text-stone-600">{c.lastMessage.sender.name}: </span>
                          {c.lastMessage.messageType === "TEXT" ? c.lastMessage.message : `[Shared ${c.lastMessage.messageType.toLowerCase()}]`}
                        </>
                      ) : (
                        <span className="italic text-stone-405">No messages yet</span>
                      )}
                    </p>

                    {/* Meta Indicators */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {c.isPinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      {c.isSuspended && (
                        <span className="text-[8px] bg-red-50 text-red-600 border border-red-100 rounded px-1 uppercase tracking-wider font-semibold">
                          Suspended
                        </span>
                      )}
                      {c.isReported && (
                        <span className="text-[8px] bg-amber-50 text-amber-605 border border-amber-100 rounded px-1 uppercase tracking-wider font-semibold">
                          Reported
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread count badge */}
                  {c.unreadCount > 0 && (
                    <span className="absolute right-4 bottom-4 bg-stone-900 text-white font-bold text-[9px] rounded-full h-4.5 min-w-4.5 flex items-center justify-center px-1 shadow-sm">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. Main Chat Panel */}
      <main className="flex-1 flex flex-col h-full bg-white relative">
        {activeConv ? (
          <>
            {/* Chat header */}
            <header className="px-6 py-4 border-b border-stone-200 flex items-center justify-between shadow-sm bg-stone-50/20">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-9.5 w-9.5 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-sm uppercase">
                    {(activeConv.otherParticipants[0]?.name || "S").charAt(0)}
                  </div>
                  {activeConv.otherParticipants[0]?.isOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-stone-800">
                    {activeConv.otherParticipants[0]?.name || "Customer Support"}
                  </h3>
                  <div className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1.5">
                    <span className="capitalize">{activeConv.type.toLowerCase().replace("_", " ")} Chat</span>
                    <span>•</span>
                    <span className={activeConv.otherParticipants[0]?.isOnline ? "text-emerald-600 font-semibold" : "text-stone-400"}>
                      {activeConv.otherParticipants[0]?.isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat action controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTogglePin(activeConv.id, activeConv.isPinned)}
                  title={activeConv.isPinned ? "Unpin chat" : "Pin chat"}
                  className={`p-2 rounded-lg border transition ${
                    activeConv.isPinned 
                      ? "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100" 
                      : "border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                  }`}
                >
                  <Pin className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleToggleArchive(activeConv.id, activeConv.isArchived)}
                  title={activeConv.isArchived ? "Unarchive chat" : "Archive chat"}
                  className={`p-2 rounded-lg border transition ${
                    activeConv.isArchived
                      ? "bg-stone-900 text-white border-stone-850 hover:bg-stone-800"
                      : "border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                  }`}
                >
                  <Archive className="h-4 w-4" />
                </button>

                {role === "ADMIN" && activeConv.isSuspended && (
                  <button
                    onClick={() => handleAdminSuspend(activeConv.id, "UNSUSPEND")}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 cursor-pointer"
                  >
                    <Unlock className="h-3.5 w-3.5" /> Lift Suspension
                  </button>
                )}

                {role === "ADMIN" && !activeConv.isSuspended && (
                  <button
                    onClick={() => handleAdminSuspend(activeConv.id, "SUSPEND")}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5" /> Suspend Chat
                  </button>
                )}

                {role !== "ADMIN" && (
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-650 hover:bg-red-50/55 transition cursor-pointer"
                  >
                    <Flag className="h-3.5 w-3.5" /> Report Chat
                  </button>
                )}
                
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 border border-stone-200 text-stone-500 rounded-lg hover:bg-stone-50 text-xs font-semibold"
                >
                  {isSidebarOpen ? "Hide info" : "Show info"}
                </button>
              </div>
            </header>

            {/* Messages scrolling container */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-50/20"
            >
              {hasMoreMessages && (
                <button 
                  onClick={() => loadMessageLogs(activeConv.id, messagePage + 1, true)}
                  className="mx-auto block text-[10px] uppercase font-bold text-stone-400 border border-stone-200 bg-white hover:bg-stone-50 rounded-full px-4 py-1.5 shadow-sm transition"
                >
                  Load older messages
                </button>
              )}

              {messages.map((m) => {
                const isMe = m.senderId === activeConv?.userId;
                
                return (
                  <div 
                    key={m.id} 
                    className={`flex flex-col max-w-[70%] group ${
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    {/* Username indicator */}
                    <span className="text-[9px] font-bold text-stone-450 uppercase mb-1 tracking-wider px-1">
                      {isMe ? "You" : m.sender.name}
                    </span>

                    {/* Bubble container */}
                    <div className="relative flex items-center gap-2 group/bubble">
                      
                      {/* Left actions trigger (for hover - reactions / edit) */}
                      {isMe && !m.isDeleted && !activeConv.isSuspended && (
                        <div className="opacity-0 group-hover/bubble:opacity-100 transition flex gap-1 text-stone-400">
                          <button onClick={() => handleStartEdit(m)} title="Edit"><Edit className="h-3.5 w-3.5 hover:text-stone-800" /></button>
                          <button onClick={() => handleDelete(m.id)} title="Delete"><Trash2 className="h-3.5 w-3.5 hover:text-stone-800" /></button>
                        </div>
                      )}

                      {/* Message Bubble itself */}
                      <div 
                        className={`rounded-2xl px-4.5 py-3 shadow-sm text-sm relative leading-relaxed ${
                          isMe 
                            ? "bg-stone-900 text-white rounded-tr-none" 
                            : "bg-white border border-stone-200 text-stone-800 rounded-tl-none"
                        }`}
                      >
                        {/* Text Message */}
                        {editingMessageId === m.id ? (
                          <div className="flex items-center gap-2 min-w-[200px]">
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-stone-800 text-white text-xs rounded border border-stone-700 px-2 py-1 outline-none"
                            />
                            <button onClick={() => handleSaveEdit(m.id)} className="bg-white text-stone-900 rounded p-1 text-[9px] uppercase font-bold shrink-0">Save</button>
                            <button onClick={() => setEditingMessageId(null)} className="text-white hover:text-stone-300 shrink-0"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <p className={m.isDeleted ? "italic text-stone-400 text-xs" : ""}>{m.message}</p>
                        )}

                        {/* Image Preview attachment */}
                        {m.attachmentUrl && m.messageType === "IMAGE" && (
                          <div className="mt-3 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 max-w-[280px] aspect-[4/3] w-full">
                            <img
                              src={m.attachmentUrl}
                              alt="Attachment preview"
                              onClick={() => window.open(m.attachmentUrl, "_blank")}
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                            />
                          </div>
                        )}

                        {/* File download attachment */}
                        {m.attachmentUrl && m.messageType === "FILE" && (
                          <a
                            href={m.attachmentUrl}
                            download
                            className="mt-3 flex items-center gap-3 bg-stone-100 border border-stone-200 rounded-lg p-3 hover:bg-stone-200 transition text-stone-800 text-xs max-w-[250px]"
                          >
                            <FileIcon className="h-5 w-5 text-stone-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{m.attachmentName || "Download file"}</p>
                              {m.attachmentSize && (
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                  {(m.attachmentSize / 1024 / 1024).toFixed(2)} MB
                                </p>
                              )}
                            </div>
                            <ExternalLink className="h-4 w-4 text-stone-400 shrink-0" />
                          </a>
                        )}

                        {/* Pinned/Edited stamp */}
                        <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[9px] opacity-60">
                          {m.isEdited && <span>(edited)</span>}
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          {isMe && (
                            <span>
                              {m.createdAt <= activeConv.otherParticipants[0]?.lastReadAt ? (
                                <CheckCheck className="h-3 w-3 text-emerald-400 inline" />
                              ) : (
                                <Check className="h-3 w-3 inline" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Reactions overlay badge */}
                        {m.reactions && m.reactions.length > 0 && (
                          <div className="absolute -bottom-2.5 right-3 flex gap-0.5 bg-white border border-stone-200 rounded-full py-0.5 px-1.5 shadow-sm text-[10px] z-10 text-stone-700">
                            {Array.from(new Set(m.reactions.map((r: any) => r.emoji))).map((emoji: any) => {
                              const count = m.reactions.filter((r: any) => r.emoji === emoji).length;
                              return (
                                <span key={emoji} title={m.reactions.map((r: any) => r.user.name).join(", ")}>
                                  {emoji} {count > 1 ? count : ""}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Right actions trigger (for hover - reactions for other sender) */}
                      {!isMe && !m.isDeleted && !activeConv.isSuspended && (
                        <div className="opacity-0 group-hover/bubble:opacity-100 transition relative">
                          <button 
                            onClick={() => setShowEmojiPickerId(showEmojiPickerId === m.id ? null : m.id)}
                            className="text-stone-450 hover:text-stone-800"
                          >
                            <Smile className="h-4 w-4" />
                          </button>

                          {/* Quick Reactions picker popover */}
                          {showEmojiPickerId === m.id && (
                            <div className="absolute bottom-6 left-0 flex gap-1 bg-white border border-stone-200 rounded-full p-1 shadow-lg z-50">
                              {EMOJI_LIST.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReactionClick(m.id, emoji)}
                                  className="hover:scale-125 transition duration-150 p-1.5 text-md"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator bubble */}
              {typingUsers.length > 0 && (
                <div className="flex gap-2 items-center text-xs text-stone-500 italic bg-stone-100 border border-stone-150 px-4 py-2 rounded-full w-fit max-w-[200px] shadow-sm animate-pulse">
                  <div className="flex gap-1 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce delay-75" />
                    <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce delay-150" />
                  </div>
                  <span>Someone is typing...</span>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>

            {/* Shared file attachments preview container */}
            {attachment && (
              <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs font-semibold text-stone-700">
                  {attachment.type.startsWith("image/") ? (
                    <ImageIcon className="h-5 w-5 text-stone-500" />
                  ) : (
                    <FileIcon className="h-5 w-5 text-stone-500" />
                  )}
                  <span className="truncate max-w-[200px]">{attachment.name}</span>
                  <span className="text-[10px] text-stone-400 font-normal">
                    ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button 
                  onClick={() => setAttachment(null)} 
                  className="rounded-full bg-stone-200 text-stone-500 p-1 hover:bg-stone-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Chat inputs footer */}
            <footer className="p-4 border-t border-stone-200 bg-white">
              {moderationState.isSuspended ? (
                <div className="flex gap-3 items-center rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-xs">
                  <Lock className="h-5 w-5 shrink-0" />
                  <div>
                    <h4 className="font-bold">Conversation Suspended</h4>
                    <p className="text-[10px] opacity-90 mt-1">
                      {moderationState.suspendedReason || "This conversation has been temporarily suspended by an administrator due to moderation policies."}
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-3 items-center relative">
                  
                  {/* File attach trigger */}
                  <label className="p-2 border border-stone-200 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition cursor-pointer shrink-0">
                    <Paperclip className="h-5 w-5" />
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleAttachmentUpload}
                    />
                  </label>

                  {/* Input field */}
                  <input
                    type="text"
                    placeholder="Write a message..."
                    value={textInput}
                    onChange={(e) => {
                      setTextInput(e.target.value);
                      handleTypingEvent();
                    }}
                    disabled={uploading}
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 shadow-sm"
                  />

                  {/* Send button */}
                  <button
                    type="submit"
                    disabled={uploading || (!textInput.trim() && !attachment)}
                    className="p-3 bg-stone-900 text-white rounded-xl hover:bg-stone-850 transition disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {uploading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </form>
              )}
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-4">
            <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-300 shadow-inner">
              <MessageSquare className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-lg text-stone-800 font-light">Select a Conversation</h3>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Choose a sender from the sidebar inbox list to view messages or start customized product inquiries.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 3. Right Information Details Sidebar */}
      {activeConv && isSidebarOpen && (
        <aside className="w-72 border-l border-stone-200 p-6 flex flex-col h-full bg-stone-50/20 shrink-0 overflow-y-auto space-y-6">
          <h3 className="font-display text-sm font-semibold text-stone-800 border-b border-stone-150 pb-2">Details</h3>

          {/* User profile card info */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Recipient Profile</div>
            <div className="flex items-center gap-3 p-3 bg-white border border-stone-150 rounded-xl shadow-sm">
              <div className="h-8 w-8 rounded-full bg-stone-200 flex items-center justify-center font-bold text-xs uppercase">
                {activeConv.otherParticipants[0]?.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold text-stone-900 truncate">{activeConv.otherParticipants[0]?.name}</p>
                <p className="text-stone-400 truncate mt-0.5">{activeConv.otherParticipants[0]?.email}</p>
                <span className="inline-block bg-stone-100 text-stone-600 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold mt-1">
                  {activeConv.otherParticipants[0]?.role}
                </span>
              </div>
            </div>
          </div>

          {/* Product context */}
          {activeConv.product && (
            <div className="space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Discussing Item</div>
              <div className="border border-stone-150 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col justify-between">
                <div className="aspect-[4/3] w-full bg-stone-100 relative">
                  <img
                    src={activeConv.product.images?.[0] || ""}
                    alt={activeConv.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-stone-900 truncate">{activeConv.product.name}</p>
                  <p className="text-stone-500">Brand: {activeConv.product.brand}</p>
                  <Link
                    href={`/product/${activeConv.productId}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-800 hover:underline pt-1"
                  >
                    View Product Page <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Order reference context */}
          {activeConv.order && (
            <div className="space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Linked Order Reference</div>
              <div className="p-4 bg-white border border-stone-150 rounded-xl shadow-sm text-xs space-y-2">
                <div className="flex justify-between font-semibold">
                  <span className="text-stone-900">#{activeConv.order.orderNumber}</span>
                  <span className="text-stone-800">₹{activeConv.order.totalAmount}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-stone-400">Order Status:</span>
                  <span className="bg-stone-100 text-stone-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {activeConv.order.status}
                  </span>
                </div>
                <Link
                  href={`/account/orders`}
                  className="block text-center rounded bg-stone-100 hover:bg-stone-200 py-1.5 font-bold text-[10px] uppercase text-stone-700 tracking-wider transition mt-2"
                >
                  View My Orders
                </Link>
              </div>
            </div>
          )}

          {/* RFQ context details */}
          {activeConv.rfq && (
            <div className="space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Wholesale Quotation Context</div>
              <div className="p-4 bg-white border border-stone-150 rounded-xl shadow-sm text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Target MOQ:</span>
                  <span className="font-semibold text-stone-900">{activeConv.rfq.quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Target Price:</span>
                  <span className="font-semibold text-stone-900">₹{activeConv.rfq.targetPrice}/pc</span>
                </div>
                <div className="flex items-center justify-between text-[10px] pt-1">
                  <span className="text-stone-400">RFQ Status:</span>
                  <span className="bg-stone-100 text-stone-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {activeConv.rfq.status}
                  </span>
                </div>
                <Link
                  href={role === "SELLER" ? "/seller/rfqs" : "/b2b/rfqs"}
                  className="block text-center rounded bg-stone-100 hover:bg-stone-200 py-1.5 font-bold text-[10px] uppercase text-stone-700 tracking-wider transition mt-2"
                >
                  View RFQ Inquiry Panel
                </Link>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* 4. Report Conversation Modal Dialog */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white rounded-xl p-6 shadow-xl border border-stone-200 relative">
            <button 
              onClick={() => setIsReportModalOpen(false)}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-display text-lg font-semibold text-stone-900 flex items-center gap-2 mb-2">
              <ShieldAlert className="h-5 w-5 text-red-500" /> Report Abuse or Harassment
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Our compliance team will review conversation message logs and files. Please explain what happened.
            </p>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe why you are reporting this chat..."
                rows={4}
                required
                className="w-full border border-stone-200 rounded-lg p-3 text-xs outline-none focus:border-stone-400"
              />
              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 text-xs font-semibold tracking-wide cursor-pointer"
              >
                Submit Report Details
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
