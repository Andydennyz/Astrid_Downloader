import { AuthProvider as SupabaseAuthProvider } from "@/hooks/use-auth.ts";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}
