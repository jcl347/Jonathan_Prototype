"use client";

import dynamic from "next/dynamic";

const ProvidersPage = dynamic(() => import("../components/providers-page"), {
  ssr: false,
  loading: () => <div className="text-center py-20 text-gray-500">Loading providers...</div>,
});

export default function Page() {
  return <ProvidersPage />;
}
