import type { Coordinate, ISeriesPrimitivePaneRenderer } from "lightweight-charts";
import type { MousePosition } from "../utils/mouse";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import { positionsBox } from "../utils/positions";
import { drawCircleBody, drawRectangleWithBorder } from "../utils/draw";

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
  price: number;
}

interface PaneRendererUpdateParams {
  p1: ViewPoint;
  p2: ViewPoint;
  p3: ViewPoint;
  p4: ViewPoint;
  mouse: MousePosition | null;
  isHovered: boolean;
  isSelected: boolean;
  hoveringPoint: "p1" | "p2" | "p3" | "p4" | null;
}

export default class RectanglePaneRenderer implements ISeriesPrimitivePaneRenderer {
  private params: PaneRendererUpdateParams | null = null;

  update(params: PaneRendererUpdateParams) {
    this.params = params;
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      const { p1, p2, p3, p4, isHovered, isSelected } = this.params ?? {};
      const isHighlighted = isHovered || isSelected;
      if (
        p1?.x == null ||
        p1?.y == null ||
        p2?.x == null ||
        p2?.y == null ||
        p3?.x == null ||
        p3.y == null ||
        p4?.x == null ||
        p4.y == null
      )
        return;
      const ctx = scope.context;

      const horizontalPositions = positionsBox(p1.x, p2.x, scope.horizontalPixelRatio);
      const verticalPositions = positionsBox(p1.y, p2.y, scope.verticalPixelRatio);
      const pp4_y = positionsBox(p2.y, p4.y, scope.verticalPixelRatio);

      const stopLossBgColor = "rgba(242, 53, 69, 0.2)";
      const profitBgColor = "rgba(3, 153, 129, 0.2)";

      const long = p2.price && p1.price && p2.price < p1.price;

      const point1_x = horizontalPositions.position;
      const point1_y = verticalPositions.position;

      const point2_x = horizontalPositions.position + horizontalPositions.length;
      const point2_y = verticalPositions.position + verticalPositions.length;

      const point4_x = horizontalPositions.position + horizontalPositions.length;

      ctx.save();

      drawRectangleWithBorder(
        ctx,
        { x: point1_x, y: point1_y },
        { x: point2_x, y: point2_y },
        stopLossBgColor,
        scope.bitmapSize.width
      );

      drawRectangleWithBorder(
        ctx,
        { x: p1.x < p2.x ? point1_x : point2_x, y: long ? point1_y : point2_y },
        { x: p1.x < p2.x ? point4_x : point1_x, y: long ? pp4_y.position : pp4_y.position + pp4_y.length },
        profitBgColor,
        scope.bitmapSize.width
      );

      if (isHighlighted) {
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        const riskToReward = Math.abs(p1.price - p4.price) / Math.abs(p1.price - p2.price);
        const middlePosition = horizontalPositions.position + horizontalPositions.length / 2;

        ctx.fillText(
          `RR: ${riskToReward.toFixed(2)}`,
          middlePosition,
          verticalPositions.position + 30 + (long ? 0 : verticalPositions.length)
        );

        ctx.fillText(
          `Target: ${p4.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
          middlePosition,
          long ? pp4_y.position - 25 : pp4_y.position + pp4_y.length + 47
        );

        ctx.fillText(
          `Stop: ${p2.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
          middlePosition,
          long ? point2_y + 25 : point1_y - 13
        );

        ctx.fillStyle = "black";
        drawCircleBody(ctx, { x: p1.x < p2.x ? point1_x : point2_x, y: long ? point1_y : point2_y }, 15, 4);
        drawCircleBody(ctx, { x: p1.x < p2.x ? point2_x : point1_x, y: long ? point2_y : point1_y }, 15, 4);
        drawCircleBody(ctx, { x: p1.x < p2.x ? point2_x : point1_x, y: long ? point1_y : point2_y }, 15, 4);
        drawCircleBody(
          ctx,
          {
            x: p1.x < p2.x ? horizontalPositions.position + horizontalPositions.length : horizontalPositions.position,
            y: long ? pp4_y.position : pp4_y.position + pp4_y.length,
          },
          15,
          4
        );
      }

      ctx.restore();
    });
  }
}
