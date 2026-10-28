export const TOOLTIP_STYLE = {
  backgroundColor: "#000",
  borderColor: "rgba(255,255,255,0.2)",
  borderRadius: "8px"
} as const;

export const AXIS = { stroke: "#8a8a8f", fontSize: 11 } as const;

/** One colour for data, teal for the selection, dimmed for the rest when something is selected. */
export const barFill = (isSelected: boolean, anySelected: boolean): string =>
  isSelected ? "#2dd4bf" : anySelected ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)";
