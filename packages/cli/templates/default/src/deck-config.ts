import type { SlideConfig } from "promptslide";
import { SlideTitle } from "@/slides/slide-title";
import { SlideExample } from "@/slides/slide-example";

export const slides: SlideConfig[] = [
  { id: "title", component: SlideTitle, steps: 0 },
  { id: "example", component: SlideExample, steps: 2 },
];
