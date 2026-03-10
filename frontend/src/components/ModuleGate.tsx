import { ReactNode } from "react";

interface ModuleGateProps {
  enabled: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ModuleGate({ enabled, children, fallback = null }: ModuleGateProps) {
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}
