import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ensureKycApproved } from "@/actions/kyc";
import { getNotificationPrefs } from "@/actions/preferences";
import { SettingsForm } from "./settings-form";

export default async function Page() {
  await ensureKycApproved();

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [profile, notificationPrefs] = await Promise.all([
    prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { storeName: true },
    }),
    getNotificationPrefs(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl">Store settings</h1>
      <SettingsForm
        initialStoreName={profile?.storeName ?? ""}
        initialNotificationPrefs={notificationPrefs}
      />
    </div>
  );
}
