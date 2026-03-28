"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("./components/dashboard"), {
  ssr: false,
  loading: () => <div style={{ textAlign: "center", padding: "5rem 0", color: "#999" }}>Loading dashboard...</div>,
});

export default function Page() {
  return <Dashboard />;
}
