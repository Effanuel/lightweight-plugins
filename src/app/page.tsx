import dynamic from "next/dynamic";
import { data } from "@/data";

const Chart = dynamic(() => import("@/components/Chart/Chart"), { loading: () => <p>Loading ...</p>, ssr: true });

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col">
      <Chart candles={data} />
    </div>
  );
}
