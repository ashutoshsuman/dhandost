import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { Button, Input } from "@/components/ui-primitives";

export const Route = createFileRoute("/profile")({
  component: () => (
    <Layout>
      <ProfilePage />
    </Layout>
  ),
});

function ProfilePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
      } else {
        const fullName = (data?.full_name ?? "").trim();
        const idx = fullName.indexOf(" ");
        if (idx === -1) {
          setFirstName(fullName);
          setLastName("");
        } else {
          setFirstName(fullName.slice(0, idx));
          setLastName(fullName.slice(idx + 1).trim());
        }
      }
      setLoading(false);
    })();
  }, []);

  const canSave =
    !!userId &&
    !saving &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0;

  const onSave = async () => {
    if (!userId) return;
    setSaving(true);
    const combinedName = `${firstName.trim()} ${lastName.trim()}`;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: combinedName })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save profile");
    } else {
      toast.success("Profile updated");
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage how your name appears in DhanDost.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <header className="px-5 py-3 border-b border-border">
          <h2 className="font-semibold">Name</h2>
        </header>
        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="text-sm font-medium">
                  First Name
                </label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end">
                <Button onClick={onSave} disabled={!canSave}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
