"use client";

import { useEffect, useState, ReactNode } from "react";

export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="text-center py-20 text-gray-500">Loading...</div>;
  return <>{children}</>;
}
