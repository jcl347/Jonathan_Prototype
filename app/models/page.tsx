"use client";

import dynamic from "next/dynamic";

const ModelsPage = dynamic(() => import("../components/models-page"), {
  ssr: false,
  loading: () => <div className="text-center py-20 text-gray-500">Loading model data...</div>,
});

export default function Page() {
  return <ModelsPage />;
}
