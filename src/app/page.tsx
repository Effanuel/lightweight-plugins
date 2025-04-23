import dynamic from "next/dynamic";
import { data } from "@/data";
import OrderPanel from "@/components/OrderPanel/OrderPanel";

const Chart = dynamic(() => import("@/components/Chart/Chart"), { loading: () => <p>Loading ...</p>, ssr: true });

export default function Home() {
  return (
    <div className="flex h-screen w-screen space-x-4 p-4 dark">
      <Chart candles={data} />
      <OrderPanel />
    </div>
  );
}
