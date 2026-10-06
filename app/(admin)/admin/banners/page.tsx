import { SmartImage } from "@/components/site/smart-image";
import { HERO_SLIDES } from "@/lib/mock-data";

export default function Page() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl">Homepage banners</h1>

      <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700">
        These are the banners currently shown on the homepage. They&apos;re
        defined in source code for now — a database-backed banner editor is
        coming soon. To change them today, edit <code>lib/mock-data.ts</code>.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {HERO_SLIDES.map((s) => (
          <div key={s.title} className="overflow-hidden rounded-md border border-border bg-card">
            <SmartImage src={s.image} className="aspect-[16/9] w-full object-cover" alt="" />
            <div className="p-3 text-sm">
              <div className="font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.cta} → {s.href}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
