import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";

export default async function Page() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Profile</h1>
      <ProfileForm initialName={user.name} email={user.email} initialPhone={user.phone ?? ""} />
    </div>
  );
}
