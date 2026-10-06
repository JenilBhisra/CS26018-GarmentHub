"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { HelpCircle, EyeOff, Eye, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { moderateQuestion, deleteAnswerAdmin } from "@/actions/qa";

export default function AdminQAClient({ initialQuestions }: { initialQuestions: any[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const paginatedQuestions = questions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(questions.length / pageSize);

  const handleToggleHide = async (questionId: string, currentHidden: boolean) => {
    setProcessingId(questionId);
    try {
      const res = await moderateQuestion(questionId, !currentHidden);
      if (res.success) {
        toast.success(!currentHidden ? "Question hidden from catalog" : "Question marked visible");
        setQuestions(
          questions.map((q) =>
            q.id === questionId ? { ...q, isHidden: !currentHidden } : q
          )
        );
      } else {
        toast.error(res.error || "Failed to update question status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteAnswer = async (questionId: string, answerId: string) => {
    if (!confirm("Are you sure you want to delete this answer?")) return;
    try {
      const res = await deleteAnswerAdmin(answerId);
      if (res.success) {
        toast.success("Answer deleted successfully");
        setQuestions(
          questions.map((q) => {
            if (q.id === questionId) {
              return {
                ...q,
                answers: q.answers.filter((ans: any) => ans.id !== answerId),
              };
            }
            return q;
          })
        );
      } else {
        toast.error(res.error || "Failed to delete answer.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Product Q&A Moderation</h1>
        <p className="text-sm text-stone-500 mt-1">
          Monitor product questions and answers, hide inappropriate inquiries, or remove vendor responses.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white p-12 text-center text-stone-500">
          <HelpCircle className="mx-auto h-8 w-8 text-stone-300 mb-3" />
          <h3 className="font-medium text-stone-800 text-sm">No questions found</h3>
          <p className="text-xs text-stone-400 mt-1">Questions posted on the platform will be listed here.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {paginatedQuestions.map((q) => (
            <div key={q.id} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Product</div>
                  <div className="font-medium text-stone-900 text-sm">{q.product.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-stone-500 mr-2">
                    Asked: {new Date(q.createdAt).toLocaleDateString("en-IN")}
                  </div>
                  {q.isHidden ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
                      <AlertTriangle className="h-3 w-3" /> Hidden
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
                      Active
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="border-t border-stone-100 pt-4 space-y-2">
                <div className="text-xs text-stone-500 font-bold">
                  Question by {q.user.name} ({q.user.email}):
                </div>
                <p className="text-sm text-stone-800 font-medium whitespace-pre-line bg-stone-50 p-3 rounded">
                  {q.question}
                </p>
              </div>

              {/* Answers & Moderation Actions */}
              {q.answers && q.answers.length > 0 && (
                <div className="space-y-3 pl-4 border-l-2 border-stone-200">
                  {q.answers.map((ans: any) => (
                    <div key={ans.id} className="bg-stone-50 rounded-lg p-4 flex justify-between gap-4 items-start border border-stone-100">
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                          Answer from {ans.seller.storeName}:
                        </div>
                        <p className="text-xs text-stone-700 whitespace-pre-line leading-relaxed">{ans.answer}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnswer(q.id, ans.id)}
                        className="text-stone-400 hover:text-red-600 transition p-1"
                        title="Delete Answer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Question Visibility Toggle */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleToggleHide(q.id, q.isHidden)}
                  disabled={processingId === q.id}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    q.isHidden
                      ? "border-emerald-200 hover:bg-emerald-50 text-emerald-700"
                      : "border-red-200 hover:bg-red-50 text-red-700"
                  }`}
                >
                  {q.isHidden ? (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Make Active
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Hide Question
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3 bg-white sm:px-6 rounded-xl shadow-sm">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-stone-700">
                Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, questions.length)}</span> of{" "}
                <span className="font-medium">{questions.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm bg-white" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:opacity-50"
                >
                  &larr;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = pNum === currentPage;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${isCurrent ? "z-10 bg-stone-900 text-white" : "text-stone-900 ring-1 ring-inset ring-stone-300 hover:bg-stone-50"}`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:opacity-50"
                >
                  &rarr;
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
