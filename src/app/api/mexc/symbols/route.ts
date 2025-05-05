import { NextResponse } from "next/server";

export const revalidate = 3600; // Cache for 1 hour (in seconds)

interface MexcSymbolsResponse {
  success: boolean;
  code: number;
  data: { symbol: string; displayNameEn: string; priceScale: number }[];
}

export async function GET() {
  try {
    // Fetch fresh data from MEXC API
    const response = await fetch("https://contract.mexc.com/api/v1/contract/detail", {
      next: { revalidate: 3600 }, // 1 hour in seconds
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as MexcSymbolsResponse;

    if (!data.data) {
      throw new Error("Invalid response format from MEXC API");
    }

    // Process and filter the symbols
    const symbols = data.data
      .filter((contract) => contract.symbol.endsWith("_USDT")) // Only include USDT pairs
      .map((contract) => ({
        symbol: contract.symbol,
      }));

    return NextResponse.json(symbols);
  } catch (error) {
    console.error("Error fetching symbols from MEXC:", error);

    // Return a fallback list of major symbols
    const fallbackSymbols = [
      { symbol: "BTC_USDT" },
      { symbol: "ETH_USDT" },
      { symbol: "SOL_USDT" },
      { symbol: "XRP_USDT" },
      { symbol: "DOGE_USDT" },
    ];

    // Return fallback symbols with error status for client awareness
    return NextResponse.json(fallbackSymbols, {
      status: 200,
      headers: {
        "X-Error": "Failed to fetch from API, using fallback data",
      },
    });
  }
}
