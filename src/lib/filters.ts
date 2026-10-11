export const FILTERS: Record<string, { label: string; ff: string; css: string }> = {
  none: { label: "Normal", ff: "", css: "none" },
  vivid: { label: "Vivid", ff: "eq=saturation=1.45:contrast=1.08", css: "saturate(1.45) contrast(1.08)" },
  warm: { label: "Warm", ff: "colorbalance=rs=.10:gs=.03:bs=-.10", css: "sepia(.25) saturate(1.2)" },
  cool: { label: "Cool", ff: "colorbalance=rs=-.08:bs=.12", css: "hue-rotate(-12deg) saturate(1.1)" },
  mono: { label: "Mono", ff: "hue=s=0", css: "grayscale(1)" },
  vintage: { label: "Vintage", ff: "curves=preset=vintage", css: "sepia(.55) contrast(.95)" },
  drama: { label: "Drama", ff: "eq=contrast=1.3:brightness=-0.03:saturation=1.15", css: "contrast(1.3) brightness(.97) saturate(1.15)" },
  glow: { label: "Glow", ff: "eq=brightness=0.07:contrast=0.95:saturation=1.2", css: "brightness(1.07) contrast(.95) saturate(1.2)" },
  fade: { label: "Fade", ff: "eq=contrast=0.85:saturation=0.75:brightness=0.04", css: "contrast(.85) saturate(.75) brightness(1.04)" },
};

export const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 3];
