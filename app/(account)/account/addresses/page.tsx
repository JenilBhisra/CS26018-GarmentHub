import { MapPin } from "lucide-react";

export default function Page() {
  return (
    <div>
      <h1 className="font-display text-3xl">Addresses</h1>

      <div className="mt-5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700">
        A saved address book is coming soon. For now, enter your delivery
        address directly at checkout for each order.
      </div>

      <div className="mt-5 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        <MapPin className="h-6 w-6" />
        No saved addresses yet.
      </div>
    </div>
  );
}
