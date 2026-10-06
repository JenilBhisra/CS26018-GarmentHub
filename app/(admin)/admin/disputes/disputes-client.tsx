"use client";

import React, { useState, useTransition } from "react";
import { updateDisputeAdmin, addDisputeNote } from "@/actions/disputes";
import { toast } from "sonner";
import { Search, Loader2, AlertCircle, MessageSquare, Shield, User, Store, Calendar, ArrowRight } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DisputeStatus, DisputePriority } from "@prisma/client";

interface DisputeNoteData {
  id: string;
  note: string;
  isInternal: boolean;
  authorName: string;
  authorRole: string;
  createdAt: Date;
}

interface DisputeData {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  productId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  sellerId: string | null;
  sellerStoreName: string | null;
  reason: string;
  description: string;
  status: DisputeStatus;
  priority: DisputePriority;
  adminNotes: string | null;
  createdAt: Date;
  notes: DisputeNoteData[];
}

interface DisputesClientProps {
  disputes: DisputeData[];
}

export default function DisputesClient({ disputes }: DisputesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get("priority") || "ALL");

  // Selected Dispute for details overlay
  const [activeDispute, setActiveDispute] = useState<DisputeData | null>(null);

  // Note Form State
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(true);
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

  // Admin Controls State
  const [newStatus, setNewStatus] = useState<DisputeStatus | "">("");
  const [newPriority, setNewPriority] = useState<DisputePriority | "">("");
  const [newAdminNotes, setNewAdminNotes] = useState("");
  const [isControlSubmitting, setIsControlSubmitting] = useState(false);

  const applyFilters = (searchVal: string, statusVal: string, priorityVal: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchVal.trim()) {
      params.set("search", searchVal.trim());
    } else {
      params.delete("search");
    }
    if (statusVal !== "ALL") {
      params.set("status", statusVal);
    } else {
      params.delete("status");
    }
    if (priorityVal !== "ALL") {
      params.set("priority", priorityVal);
    } else {
      params.delete("priority");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, statusFilter, priorityFilter);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    applyFilters(search, val, priorityFilter);
  };

  const handlePriorityFilterChange = (val: string) => {
    setPriorityFilter(val);
    applyFilters(search, statusFilter, val);
  };

  // Open Detail Overlay
  const handleSelectDispute = (disdis: DisputeData) => {
    setActiveDispute(disdis);
    setNewStatus(disdis.status);
    setNewPriority(disdis.priority);
    setNewAdminNotes(disdis.adminNotes || "");
    setReplyText("");
  };

  // Submit Note Reply
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDispute) return;
    if (!replyText.trim()) {
      toast.error("Reply text cannot be empty.");
      return;
    }

    setIsNoteSubmitting(true);
    try {
      const res = await addDisputeNote(activeDispute.id, replyText, isInternalNote);
      if (res.success) {
        toast.success(isInternalNote ? "Internal log note added." : "Public reply sent successfully.");
        // Refresh local list
        const updatedDisDis = disputes.find((d) => d.id === activeDispute.id);
        if (updatedDisDis) {
          // Trigger hot reloading local notes in view
          const newNote: DisputeNoteData = {
            id: Math.random().toString(),
            note: replyText,
            isInternal: isInternalNote,
            authorName: "Administrator",
            authorRole: "ADMIN",
            createdAt: new Date(),
          };
          setActiveDispute({
            ...activeDispute,
            notes: [...activeDispute.notes, newNote],
          });
        }
        setReplyText("");
        router.refresh();
      } else {
        toast.error("Failed to post note.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  // Submit Admin Controls (Status, Priority, internal notes)
  const handleControlsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDispute) return;

    setIsControlSubmitting(true);
    try {
      const res = await updateDisputeAdmin(activeDispute.id, {
        status: newStatus || undefined,
        priority: newPriority || undefined,
        adminNotes: newAdminNotes || undefined,
      });

      if (res.success) {
        toast.success("Dispute settings successfully updated.");
        setActiveDispute({
          ...activeDispute,
          status: newStatus || activeDispute.status,
          priority: newPriority || activeDispute.priority,
          adminNotes: newAdminNotes || activeDispute.adminNotes,
        });
        router.refresh();
      } else {
        toast.error("Failed to update settings.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsControlSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Dispute Center</h1>
        <p className="text-sm text-muted-foreground">Mediate and resolve complaints between customers, orders, and vendors.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search store name or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm text-foreground focus:border-accent outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="WAITING_FOR_SELLER">Waiting for Seller</option>
              <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Priority:</label>
            <select
              value={priorityFilter}
              onChange={(e) => handlePriorityFilterChange(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Disputes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {disputes.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <AlertCircle className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">No Dispute Tickets</h3>
            <p className="text-xs mt-1">There are no open disputes matching your filters.</p>
          </div>
        ) : (
          disputes.map((d) => (
            <div
              key={d.id}
              onClick={() => handleSelectDispute(d)}
              className="group cursor-pointer rounded-lg border border-border bg-card p-5 hover:border-foreground/35 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground font-mono">
                    DISP-{d.id.substring(0, 8).toUpperCase()}
                  </span>
                  <div className="flex gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        d.priority === "URGENT" || d.priority === "HIGH"
                          ? "bg-red-50 text-red-700"
                          : d.priority === "MEDIUM"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-50 text-gray-700"
                      }`}
                    >
                      {d.priority}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        d.status === "OPEN"
                          ? "bg-amber-100 text-amber-800"
                          : d.status === "RESOLVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {d.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                    {d.reason}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {d.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{d.notes.length} replies</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Review Ticket</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Details Dialog Overlay */}
      {activeDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl flex flex-col justify-between rounded-l-xl overflow-hidden animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="border-b border-border p-5 flex justify-between items-start bg-muted/20">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground font-mono">
                    DISP-{activeDispute.id.toUpperCase()}
                  </span>
                  {activeDispute.orderNumber && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded font-semibold text-foreground">
                      Order: {activeDispute.orderNumber}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl mt-1.5">{activeDispute.reason}</h2>
              </div>
              <button
                onClick={() => setActiveDispute(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1 bg-muted rounded-full w-7 h-7 flex items-center justify-center hover:bg-muted/80 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Context Block */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-4 text-xs">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-semibold text-muted-foreground">Customer</div>
                    <div className="text-foreground mt-0.5">{activeDispute.customerName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-semibold text-muted-foreground">Seller / Store</div>
                    <div className="text-foreground mt-0.5">{activeDispute.sellerStoreName || "Global Platform"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-semibold text-muted-foreground">Filed On</div>
                    <div className="text-foreground mt-0.5">
                      {new Date(activeDispute.createdAt).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-semibold text-muted-foreground">Mediator</div>
                    <div className="text-foreground mt-0.5">Platform Admin</div>
                  </div>
                </div>
              </div>

              {/* Main Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Description / Context</h4>
                <p className="text-sm bg-card border border-border rounded-lg p-4 leading-relaxed whitespace-pre-wrap text-foreground">
                  {activeDispute.description}
                </p>
              </div>

              {/* Administrative Settings Form */}
              <form onSubmit={handleControlsSubmit} className="rounded-lg border border-border p-4 space-y-4 bg-muted/10">
                <div className="font-semibold text-sm border-b border-border pb-1.5">Admin Mediation Panel</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Resolution Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as DisputeStatus)}
                      className="w-full rounded border border-input bg-background p-1.5 text-xs text-foreground outline-none cursor-pointer"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="WAITING_FOR_SELLER">Waiting for Seller</option>
                      <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Ticket Priority</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as DisputePriority)}
                      className="w-full rounded border border-input bg-background p-1.5 text-xs text-foreground outline-none cursor-pointer"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Mediator Internal Notes (Private to Admin)</label>
                  <textarea
                    placeholder="Enter internal audit logs, observations, chargeback notes..."
                    value={newAdminNotes}
                    onChange={(e) => setNewAdminNotes(e.target.value)}
                    className="w-full min-h-[50px] text-xs rounded border border-input bg-background p-2 outline-none"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isControlSubmitting}
                    className="rounded bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    {isControlSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Update Dispute Settings
                  </button>
                </div>
              </form>

              {/* Message Reply Thread */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Mediation Message Thread</h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {activeDispute.notes.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      No replies logged yet on this dispute.
                    </div>
                  ) : (
                    activeDispute.notes.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-lg p-3 text-xs leading-relaxed space-y-1 border ${
                          n.isInternal
                            ? "bg-amber-50/50 border-amber-200 text-amber-900"
                            : n.authorRole === "ADMIN"
                            ? "bg-indigo-50/50 border-indigo-200 text-indigo-900"
                            : "bg-muted/40 border-border text-foreground"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] opacity-75 font-semibold">
                          <span>
                            {n.authorName} ({n.authorRole}) {n.isInternal && "• [INTERNAL NOTE]"}
                          </span>
                          <span>{new Date(n.createdAt).toLocaleString("en-IN")}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{n.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Note Reply Form footer */}
            <div className="border-t border-border p-4 bg-muted/10">
              <form onSubmit={handleNoteSubmit} className="space-y-3">
                <textarea
                  placeholder="Type a reply note to resolve this dispute..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full min-h-[60px] rounded-lg border border-input bg-background p-2.5 text-sm text-foreground focus:border-accent outline-none"
                  required
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="accent-accent"
                    />
                    <span>Log as Private Admin Note (Hidden from Customer & Seller)</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isNoteSubmitting}
                    className="rounded bg-accent text-accent-foreground px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    {isNoteSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Send Response
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
