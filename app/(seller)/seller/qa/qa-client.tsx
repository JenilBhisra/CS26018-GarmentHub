"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { HelpCircle, MessageSquare, CornerDownRight, X, Send, Edit } from "lucide-react";
import { toast } from "sonner";
import { answerQuestion } from "@/actions/qa";

export default function SellerQAClient({ initialQuestions }: { initialQuestions: any[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAnswer = (question: any) => {
    setActiveQuestionId(question.id);
    const existingAns = question.answers?.[0];
    if (existingAns) {
      setActiveAnswerId(existingAns.id);
      setAnswerText(existingAns.answer);
    } else {
      setActiveAnswerId(null);
      setAnswerText("");
    }
  };

  const handleCloseAnswer = () => {
    setActiveQuestionId(null);
    setActiveAnswerId(null);
    setAnswerText("");
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerText.trim() || !activeQuestionId) return;

    setSubmitting(true);
    try {
      const res = await answerQuestion(activeQuestionId, activeAnswerId, answerText);
      if (res.success && res.answerId) {
        toast.success(activeAnswerId ? "Answer updated!" : "Answer posted successfully!");
        
        // Update local state
        setQuestions(
          questions.map((q) => {
            if (q.id === activeQuestionId) {
              const updatedAnswer = {
                id: res.answerId,
                questionId: activeQuestionId,
                answer: answerText.trim(),
                createdAt: new Date().toISOString(),
              };
              return {
                ...q,
                answers: [updatedAnswer],
              };
            }
            return q;
          })
        );
        handleCloseAnswer();
      } else {
        toast.error(res.error || "Failed to save answer.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Product Q&A</h1>
        <p className="text-sm text-stone-500 mt-1">
          Review and respond to questions asked by buyers about your products.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white p-12 text-center text-stone-500">
          <HelpCircle className="mx-auto h-8 w-8 text-stone-300 mb-3" />
          <h3 className="font-medium text-stone-800 text-sm">No questions yet</h3>
          <p className="text-xs text-stone-400 mt-1">Questions left on your product pages will be listed here.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {questions.map((q) => {
            const answer = q.answers?.[0];
            return (
              <div key={q.id} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Product</div>
                    <div className="font-medium text-stone-900 text-sm">{q.product.name}</div>
                  </div>
                  <div className="text-xs text-stone-500">
                    Asked: {new Date(q.createdAt).toLocaleDateString("en-IN")}
                  </div>
                </div>

                {/* Question Details */}
                <div className="border-t border-stone-100 pt-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span className="font-bold text-stone-800">Question by {q.user.name}:</span>
                  </div>
                  <p className="text-sm text-stone-800 font-medium whitespace-pre-line leading-relaxed bg-stone-50 p-3 rounded">
                    {q.question}
                  </p>
                  {q.isHidden && (
                    <span className="inline-block bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-bold text-[9px] border border-red-200 uppercase tracking-wider">
                      Hidden by Admin
                    </span>
                  )}
                </div>

                {/* Answer Details */}
                {answer ? (
                  <div className="bg-emerald-50/50 rounded-lg p-4 flex gap-3 border-l-2 border-emerald-500">
                    <CornerDownRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-center w-full">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">My Answer</div>
                        <button
                          onClick={() => handleOpenAnswer(q)}
                          className="text-[10px] text-stone-500 hover:text-stone-900 flex items-center gap-0.5 underline font-bold"
                        >
                          <Edit className="h-3 w-3" /> Edit Answer
                        </button>
                      </div>
                      <p className="text-xs text-stone-700 whitespace-pre-line leading-relaxed">{answer.answer}</p>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenAnswer(q)}
                      className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-400 rounded-lg px-3 py-1.5 transition"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Answer Question
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Answer Modal */}
      {activeQuestionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl relative">
            <button
              onClick={handleCloseAnswer}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-display text-xl text-stone-950 mb-4">
              {activeAnswerId ? "Edit Answer" : "Answer Customer Question"}
            </h3>

            <form onSubmit={handleSubmitAnswer} className="space-y-4">
              <div className="text-xs text-stone-500 bg-stone-50 rounded p-3 border border-stone-100 italic">
                &ldquo;{questions.find((q) => q.id === activeQuestionId)?.question}&rdquo;
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Your Answer
                </label>
                <textarea
                  required
                  value={answerText}
                  onChange={(e) => setModifyAnswer(e.target.value)}
                  placeholder="Provide sizing tips, material compositions, stock estimates, etc..."
                  rows={5}
                  className="w-full rounded-lg border border-stone-200 p-3 text-xs outline-none bg-stone-50 focus:border-stone-900 focus:bg-white"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCloseAnswer}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 text-white px-4 py-2 text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  <Send className="h-3 w-3" /> {submitting ? "Sending..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function setModifyAnswer(val: string) {
    setAnswerText(val);
  }
}
