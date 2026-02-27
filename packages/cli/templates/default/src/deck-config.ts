import type { SlideConfig } from "promptslide";
import { SlideTitle } from "@/slides/slide-title";
import { SlideExample } from "@/slides/slide-example";

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideExample, steps: 2 },
];
