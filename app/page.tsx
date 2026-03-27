"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("./components/dashboard"), {
  ssr: false,
  loading: () => <div className="text-center py-20 text-gray-500">Loading dashboard...</div>,
});

export default function Page() {
  return <Dashboard />;
}
