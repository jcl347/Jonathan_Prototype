"use client";

import dynamic from "next/dynamic";

const NetworkPage = dynamic(() => import("../components/network-page"), {
  ssr: false,
  loading: () => <div className="text-center py-20 text-gray-500">Loading network analysis...</div>,
});

export default function Page() {
  return <NetworkPage />;
}
