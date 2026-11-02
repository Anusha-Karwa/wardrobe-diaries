import { getProfile } from "@/lib/queries";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getProfile();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-5xl font-bold leading-none"><span className="marker">my settings</span></h1>
      <p className="mt-1 text-muted-foreground">Your profile personalises every outfit, trend and buy suggestion.</p>
      <ProfileForm initial={profile} />
    </div>
  );
}
