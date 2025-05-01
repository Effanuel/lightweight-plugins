import { CvdChartProvider } from "@/hooks/useCvdCharts";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CvdChartProvider>{children}</CvdChartProvider>;
}
