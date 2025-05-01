export function round(number: number, fraction: number) {
  const inverseFraction = 1 / fraction;
  return Math.round(number * inverseFraction) / inverseFraction;
}

// import { useWatch } from 'react-hook-form';
// import { useOrders } from '../context/order-context';
// import { useAveragePrice } from './useAveragePrice';
// import { Side } from '@core/shared/types';

type FormatPriceParams = { min?: number; max?: number; type?: "%" | "$" | "XBT" };

export function formatPrice(value: number | null | undefined, params?: FormatPriceParams) {
  const price = value?.toLocaleString("en-US", {
    minimumFractionDigits: params?.min ?? 3,
    maximumFractionDigits: params?.max ?? 3,
    currency: "USD",
    style: params?.type === "$" ? "currency" : undefined,
  });
  if (!price) {
    return null;
  }

  if (params?.type === "%") {
    return price + " %";
  }
  if (params?.type === "XBT") {
    return "XBT " + price;
  }
  return price;
}

export function calculateRiskReward(
  side: "Long" | "Short" | null,
  entries: { price: number | null; qty: number | null }[],
  stops: number[],
  profitTargets: number[],
  contractMultiplier: number = 0.0001 // Added parameter with default for shares
) {
  // --- Initial Validation ---
  if (
    !side ||
    !entries ||
    entries.length === 0 ||
    !stops ||
    stops.length === 0 ||
    !profitTargets ||
    profitTargets.length === 0 ||
    contractMultiplier <= 0 // Multiplier must be positive
  ) {
    return {
      possibleProfit: null,
      possibleLoss: null,
      riskReward: null,
    };
  }

  let totalQuantity = 0;
  let totalValue = 0;
  for (const entry of entries) {
    if (entry?.price != null && entry?.qty != null && entry.qty > 0 && entry.price > 0) {
      totalQuantity += entry.qty;
      totalValue += entry.price * entry.qty;
    }
  }

  if (totalQuantity === 0) {
    return {
      possibleProfit: null,
      possibleLoss: null,
      riskReward: null,
    };
  }

  // --- Calculations ---

  // Calculate weighted average entry price
  const averageEntryPrice = totalValue / totalQuantity;

  // Factor for direction: 1 for Long, -1 for Short
  const F = side === "Long" ? 1 : -1;

  // Calculate potential profit (best case scenario across all targets)
  // We are looking for the maximum *positive* profit based on the targets.
  let maxPotentialProfit = 0;
  for (const target of profitTargets) {
    if (target == null || target <= 0) continue; // Skip invalid targets
    // Calculate profit for this specific target
    const profitPerUnit = F * (target - averageEntryPrice);
    const totalProfitForTarget = profitPerUnit * totalQuantity * contractMultiplier;

    // We only consider positive profits and take the maximum one
    if (totalProfitForTarget > maxPotentialProfit) {
      maxPotentialProfit = totalProfitForTarget;
    }
  }
  // If no target yields a positive profit, possibleProfit remains 0.

  // Calculate potential loss (worst case scenario across all stops)
  // We are looking for the maximum *positive* loss based on the stops.
  let maxPotentialLoss = 0;
  for (const stop of stops) {
    if (stop == null || stop <= 0) continue; // Skip invalid stops
    // Calculate loss for this specific stop
    // Loss occurs when price moves from averageEntryPrice to stop
    const lossPerUnit = F * (averageEntryPrice - stop);
    const totalLossForStop = lossPerUnit * totalQuantity * contractMultiplier;

    // We only consider positive losses and take the maximum one
    if (totalLossForStop > maxPotentialLoss) {
      maxPotentialLoss = totalLossForStop;
    }
  }
  // If no stop yields a positive loss, possibleLoss remains 0.

  // Calculate risk-reward ratio
  let riskReward: number | null | typeof Infinity = null;
  if (maxPotentialLoss > 1e-9) {
    // Use epsilon to avoid division by near-zero
    // We have a measurable risk, calculate ratio
    riskReward = maxPotentialProfit / maxPotentialLoss;
  } else if (maxPotentialProfit > 1e-9) {
    // Loss is negligible, but profit is positive: effectively infinite reward for the risk
    riskReward = Infinity;
  }
  // Else: If both profit and loss are negligible, riskReward remains null

  // --- Return Results ---
  return {
    possibleProfit: Number(maxPotentialProfit.toFixed(3)), // Format to 2 decimal places
    possibleLoss: Number(maxPotentialLoss.toFixed(3)), // Format to 2 decimal places
    riskReward:
      riskReward === Infinity
        ? Infinity // Keep Infinity as is
        : riskReward !== null
        ? Number(riskReward.toFixed(2))
        : null, // Format if number, else null
  };
}

export function isLongValid(entries: { price: number | null }[], stops: { price: number | null }[]) {
  return entries.every((entry) => stops.every((stop) => stop.price! < entry.price!));
}

export function isShortValid(entries: { price: number | null }[], stops: { price: number | null }[]) {
  return entries.every((entry) => stops.every((stop) => stop.price! > entry.price!));
}

// export function useOrderSummary() {
//   const { control } = useOrders();
//   const entries = useWatch({ control, name: 'entries' });

//   const entryPriceValue = useWatch({ control, name: 'entries.0.price' });
//   const stopPrice = useWatch({ control, name: 'stopLoss.0.price' });
//   const exitPriceValue = useWatch({ control, name: 'profitTarget.0.price' });
//   const entryPrice = useAveragePrice('entries') ?? entryPriceValue;
//   const exitPrice = useAveragePrice('profitTarget') ?? exitPriceValue;
//   const side = useWatch({ control, name: 'side' });
//   // @ts-ignore
//   const entryQty = entries?.reduce((acc, entry) => acc + (entry?.qty ?? 0), 0); //* (entryPrice ?? 0);
//   //   // TODO: rename
//   const F = side === 'Long' ? 1 : -1;

//   if (!entryPrice || !exitPrice || !stopPrice) {
//     return {
//       riskReward: null,
//       possibleProfit: null,
//       possibleLoss: null,
//     };
//   } else {
//     console.log('calc2222');
//     // @ts-ignore
//     const abc = calculateRiskReward(side, entries, [stopPrice], [exitPrice]);
//     return {
//       riskReward: formatPrice(abc.riskReward, { min: 2, max: 2 }),
//       possibleProfit: formatPrice(abc.possibleProfit, { min: 4, max: 4, type: 'XBT' }),
//       possibleLoss: formatPrice(abc.possibleLoss, { min: 4, max: 4, type: 'XBT' }),
//       possibleLossValue: abc.possibleLoss,
//     };
//   }

//   //   const riskReward = exitPrice && entryPrice && stopPrice ? (exitPrice - entryPrice) / (entryPrice - stopPrice) : null;

//   //   //   const entryValue = entryPrice && entryQty ? entryQty / entryPrice : null;
//   //   //   const exitValue = profitTarget.price && profitTarget.qty ? profitTarget.qty / profitTarget.price : null;

//   //   const entryPositionValue = entryQty && entryPrice ? entryQty / entryPrice : null;

//   //   const exitPositionValue = entryQty && exitPrice && entryQty ? entryQty / exitPrice : null;
//   //   //   const possibleProfitPerc =
//   //   //     profitTarget.price && entryPrice ? F * (1 / entryPrice - 1 / profitTarget.price) * entryPrice * 100 : null;
//   //   const possibleProfit = entryPositionValue && exitPositionValue ? F * (entryPositionValue - exitPositionValue) : null;

//   //   console.log({ riskReward, entryPositionValue, possibleProfit, exitPositionValue });
//   //   return {
//   //     riskReward: formatPrice(riskReward, { min: 2, max: 2 }),
//   //     // entryPositionValue: formatPrice(entryPositionValue, { min: 4, max: 4, type: 'XBT' }),
//   //     // possibleProfitPerc: formatPrice(possibleProfitPerc, { min: 2, max: 2, type: '%' }),
//   //     possibleProfit: formatPrice(possibleProfit, { min: 4, max: 4, type: 'XBT' }),
//   //     // possibleProfitUsd:
//   //     //   possibleProfit && entryPrice ? formatPrice(possibleProfit * entryPrice, { min: 4, max: 4, type: '$' }) : null,
//   //     // percentChange:
//   //     //   side === 'Long'
//   //     //     ? profitTarget.price && entryPrice
//   //     //       ? formatPrice((profitTarget.price / entryPrice - 1) * 100, { min: 2, max: 5, type: '%' })
//   //     //       : null
//   //     //     : profitTarget.price && entryPrice
//   //     //     ? formatPrice((entryPrice / profitTarget.price - 1) * 100, { min: 2, max: 5, type: '%' })
//   //     //     : null,
//   //   };
// }

export const roundTime = (time: number, seconds: number) => {
  const timeInSeconds = Math.floor(time / 1000);
  const secondsDiff = timeInSeconds % seconds;
  return timeInSeconds - secondsDiff;
};
