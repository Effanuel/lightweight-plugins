import type { CreatePriceLineOptions, IChartApi, IPriceLine, ISeriesApi, PriceLineOptions } from "lightweight-charts";

export class PriceLinesManager {
  private priceLinesMap: Map<string, IPriceLine> = new Map();
  private series: ISeriesApi<"Candlestick"> | null = null;
  private chart: IChartApi | null = null;
  private draggingLineId: string | null = null;
  private focusedLine: { id: string; options: Partial<PriceLineOptions> } | null = null;
  private hasLineMoved = false;

  constructor() {}

  reset = () => {
    this.priceLinesMap.clear();
    this.series = null;
    this.chart = null;
    document.removeEventListener("keydown", this.keyDownListener, false);
  };

  init(chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    this.series = series;
    this.chart = chart;

    const handleMouseMove = (event: MouseEvent) => {
      console.log("mousemove");
      if (!this.draggingLineId) return;
      this.hasLineMoved = true;

      const rect = chart.chartElement().getBoundingClientRect();
      const price = series.coordinateToPrice(event.clientY - rect.top);
      if (!price) return;

      const priceLine = this.priceLinesMap.get(this.draggingLineId);

      priceLine?.applyOptions({
        price: price,
        title: `Line: ${price.toFixed(5)}`,
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      console.log("mousedown");
      const closestPriceLine = this.getClosestPriceLineToMouse(event.clientY);

      if (closestPriceLine) {
        this.draggingLineId = closestPriceLine.id;
        chart.applyOptions({ handleScroll: false, handleScale: false });
      }
    };

    const handleMouseUp = () => {
      console.log("mouseup");
      this.draggingLineId = null;
      chart.applyOptions({ handleScroll: true, handleScale: true });
    };

    chart.chartElement().addEventListener("mousemove", handleMouseMove);
    chart.chartElement().addEventListener("mousedown", handleMouseDown);
    chart.chartElement().addEventListener("mouseup", handleMouseUp);
    chart.chartElement().addEventListener("click", (event) => {
      if (this.hasLineMoved) {
        this.hasLineMoved = false;
        return;
      }
      if (this.focusedLine) {
        this.priceLinesMap.get(this.focusedLine.id)?.applyOptions({ color: this.focusedLine.options.color });
        this.focusedLine = null;
        return;
      }
      const closestPriceLine = this.getClosestPriceLineToMouse(event.clientY);
      if (closestPriceLine) {
        this.focusedLine = { id: closestPriceLine.id, options: { ...closestPriceLine.line.options() } };
        closestPriceLine.line.applyOptions({
          color: "green",
        });
      }
    });
    document.addEventListener("keydown", this.keyDownListener, false);
  }

  addPriceLine = (id: string, options: CreatePriceLineOptions) => {
    const priceLine = this.series?.createPriceLine(options);
    if (!priceLine) return;

    this.priceLinesMap.set(id, priceLine);

    return { removePriceLine: () => this.removePriceLine(id) };
  };

  removePriceLine = (id: string) => {
    const priceLine = this.priceLinesMap.get(id);
    if (priceLine) {
      this.series?.removePriceLine(priceLine);
      this.priceLinesMap.delete(id);
    }
  };

  private getClosestPriceLineToMouse(mouseY: number): { id: string; line: IPriceLine } | null {
    const rect = this.chart?.chartElement().getBoundingClientRect();
    if (!rect) return null;
    if (!this.series) return null;

    let closestPriceLine: { id: string; line: IPriceLine } | null = null;
    let closestDistance = Infinity;

    this.priceLinesMap.forEach((priceLine, priceLineId) => {
      const priceLinePrice = parseFloat(priceLine.options().price.toFixed(5));
      const priceLineCoordinate = this.series?.priceToCoordinate(priceLinePrice);
      if (!priceLineCoordinate) return null;

      const distance = Math.abs(priceLineCoordinate - mouseY + rect.top);
      if (distance < 10 && distance < closestDistance) {
        closestDistance = distance;
        closestPriceLine = { id: priceLineId, line: priceLine };
      }
    });

    return closestPriceLine;
  }

  private keyDownListener = (event: KeyboardEvent) => {
    switch (event.key) {
      case "Escape": {
        if (this.focusedLine) {
          this.priceLinesMap.get(this.focusedLine.id)?.applyOptions({ color: this.focusedLine.options.color });
          this.focusedLine = null;
        }

        break;
      }

      case "Delete":
      case "Backspace": {
        if (this.focusedLine) {
          this.removePriceLine(this.focusedLine.id);
          this.focusedLine = null;
          this.hasLineMoved = false;
          this.draggingLineId = null;
        }
        break;
      }
    }
  };
}
