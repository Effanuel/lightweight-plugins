import { ChartProvider } from "@/hooks/useChart";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ChartProvider>{children}</ChartProvider>;
}
