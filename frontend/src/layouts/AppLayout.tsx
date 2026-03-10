import { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      {children}
    </main>
  );
}
