"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface DatasetInfo {
  id: string;
  name: string;
  description: string;
  source: string;
  reliability: string;
  has_data: boolean;
  url?: string;
  download_required?: boolean;
}

interface DatasetContextType {
  currentDataset: string;
  setCurrentDataset: (id: string) => void;
  datasets: DatasetInfo[];
  loading: boolean;
}

const DatasetContext = createContext<DatasetContextType>({
  currentDataset: "synthetic",
  setCurrentDataset: () => {},
  datasets: [],
  loading: true,
});

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [currentDataset, setCurrentDataset] = useState("synthetic");
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/datasets_index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        setDatasets(data.datasets || []);
        setLoading(false);
      })
      .catch(() => {
        setDatasets([
          {
            id: "synthetic",
            name: "Synthetic ABA Fraud Dataset",
            description: "ML-generated dataset",
            source: "Generated",
            reliability: "6/10",
            has_data: true,
          },
        ]);
        setLoading(false);
      });
  }, []);

  return (
    <DatasetContext.Provider value={{ currentDataset, setCurrentDataset, datasets, loading }}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  return useContext(DatasetContext);
}
