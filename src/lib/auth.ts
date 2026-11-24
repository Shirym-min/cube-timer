import { createClient, type User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const auth = url && key ? createClient(url, key).auth : null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!auth);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const { data } = auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { user, ready, recovery, setRecovery };
}
