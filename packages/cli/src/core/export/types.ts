/** Public, serializable native export extension contract. Coordinates are design pixels. */
export interface PptxBox {
  x: number
  y: number
  width: number
  height: number
}
export interface PptxColor {
  hex: string
  alpha: number
}
export type PptxChartType = "bar" | "column" | "line" | "area" | "pie" | "doughnut" | "scatter"
export interface PptxChartData {
  type: PptxChartType
  series: Array<{ name: string; labels: string[]; values: number[] }>
  colors?: string[]
  showLegend?: boolean
  showValue?: boolean
  title?: string
  fontFamily?: string
  /** CSS pixels, converted to points in PowerPoint. */
  fontSize?: number
  textColor?: string
  background?: PptxColor
  legendPosition?: "top" | "right" | "bottom" | "left"
  valueAxis?: { min?: number; max?: number; majorUnit?: number }
  /** Plot rectangle as fractions of the chart box, excluding labels/legend. */
  plotArea?: PptxBox
  gridColor?: string
  gapSizePercent?: number
  overlapPercent?: number
}
export interface PptxAdapterNode {
  id: string
  kind: "shape" | "text" | "chart" | "table" | "picture"
  box: PptxBox
  payload: Record<string, unknown>
  name?: string
  altText?: string
}
export interface PptxExportAdapter {
  id: string
  match: (element: Element) => boolean
  ready?: (element: Element, signal: AbortSignal) => Promise<void>
  toScene: (
    element: Element,
    context: { box: PptxBox; slideId: string; signal: AbortSignal }
  ) => Promise<PptxAdapterNode[]> | PptxAdapterNode[]
}
export interface PptxFontConfig {
  family: string
  path: string
  weight?: number
  style?: "normal" | "italic"
}

/** Transport for the shared PowerPoint job API in an authenticated custom host. */
export type PptxExportRequest = (path: string, init?: RequestInit) => Promise<Response>
