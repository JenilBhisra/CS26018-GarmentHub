"use client";

import React, { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Plus, X, Check, Loader2 } from "lucide-react";
import { updateUserPreferences } from "@/actions/preferences";
import { toast } from "sonner";

export interface SavedView {
  id: string;
  label: string;
  filters: Record<string, string>;
}

interface SavedFiltersBarProps {
  /** Currently active filter state as a plain object. */
  currentFilters: Record<string, string>;
  /** The saved views loaded from user preferences. */
  savedViews: SavedView[];
  /** Called when the user applies a saved view (so the parent can update filter state). */
  onApply: (filters: Record<string, string>) => void;
  /** Called after a save/delete so the parent can sync its local preference copy. */
  onSavedViewsChange: (views: SavedView[]) => void;
  /** Full current preferences object (so we can upsert only savedViews key). */
  currentPreferences: Record<string, any>;
}

export default function SavedFiltersBar({
  currentFilters,
  savedViews,
  onApply,
  onSavedViewsChange,
  currentPreferences,
}: SavedFiltersBarProps) {
  const [isSaving, startSaveTransition] = useTransition();
  const [saveLabel, setSaveLabel] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleSave = () => {
    if (!saveLabel.trim()) {
      toast.error("Please enter a name for this filter view.");
      return;
    }

    const newView: SavedView = {
      id: `view_${Date.now()}`,
      label: saveLabel.trim(),
      filters: { ...currentFilters },
    };

    const updated = [...savedViews, newView];

    startSaveTransition(async () => {
      const res = await updateUserPreferences({
        ...currentPreferences,
        savedViews: updated,
      });

      if (res.success) {
        onSavedViewsChange(updated);
        setSaveLabel("");
        setIsAddingNew(false);
        toast.success(`Filter view "${newView.label}" saved!`);
      } else {
        toast.error("Failed to save filter view.");
      }
    });
  };

  const handleDelete = (viewId: string) => {
    const updated = savedViews.filter((v) => v.id !== viewId);

    startSaveTransition(async () => {
      const res = await updateUserPreferences({
        ...currentPreferences,
        savedViews: updated,
      });

      if (res.success) {
        onSavedViewsChange(updated);
        toast.success("Filter view removed.");
      } else {
        toast.error("Failed to delete filter view.");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Saved views list */}
      {savedViews.map((view) => (
        <div
          key={view.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm"
        >
          <BookmarkCheck className="h-3 w-3 text-indigo-500" />
          <button
            onClick={() => onApply(view.filters)}
            className="hover:text-indigo-700 transition"
          >
            {view.label}
          </button>
          <button
            onClick={() => handleDelete(view.id)}
            className="ml-0.5 text-stone-400 hover:text-rose-600 transition"
            title="Remove saved view"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Add new view input */}
      {isAddingNew ? (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5">
          <input
            type="text"
            placeholder="View name…"
            value={saveLabel}
            onChange={(e) => setSaveLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="bg-transparent text-xs font-medium w-28 focus:outline-none placeholder:text-indigo-300 text-indigo-800"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50"
            title="Save"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => {
              setIsAddingNew(false);
              setSaveLabel("");
            }}
            className="text-stone-400 hover:text-rose-600 transition"
            title="Cancel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingNew(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-500 hover:border-indigo-400 hover:text-indigo-600 transition"
          title="Save current filter as a view"
        >
          <Bookmark className="h-3 w-3" />
          Save current filters
        </button>
      )}
    </div>
  );
}
