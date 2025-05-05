import { NextRequest, NextResponse } from "next/server";

// Short revalidation time for candle data since it changes frequently
export const revalidate = 60; // Cache for 1 minute (in seconds)

interface MexcKlineResponse {
  success: boolean;
  code: 0;
  data: {
    time: number[];
    open: number[];
    close: number[];
    high: number[];
    low: number[];
    vol: number[];
    amount: number[];
    realOpen: number[];
    realClose: number[];
    realHigh: number[];
    realLow: number[];
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol") || "BTC_USDT";
  const interval = searchParams.get("interval") || "Min5";
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  try {
    // Make the request from the server
    const response = await fetch(
      `https://contract.mexc.com/api/v1/contract/kline/${symbol}?interval=${interval}&limit=${limit}`,
      {
        next: { revalidate: 60 }, // 1 minute in seconds
        cache: "force-cache",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as MexcKlineResponse;

    if (!data.data) {
      throw new Error("Invalid response format from MEXC API");
    }

    // Transform the data and return it
    const candles = data.data.time.map((item, index) => ({
      time: data.data.time[index], // Convert milliseconds to seconds for lightweight-charts
      open: data.data.open[index],
      high: data.data.high[index],
      low: data.data.low[index],
      close: data.data.close[index],
      volume: data.data.vol[index],
    }));

    return NextResponse.json(candles);
  } catch (error) {
    console.error("Error fetching candles from MEXC:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}
