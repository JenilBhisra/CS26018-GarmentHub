import { getPlatformSettings } from "@/actions/admin";
import { SettingsForm } from "./settings-form";

export default async function Page() {
  const settings = await getPlatformSettings();

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="font-display text-3xl">Platform settings</h1>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
