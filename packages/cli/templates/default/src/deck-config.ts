import type { SlideConfig } from "promptslide";
import { SlideTitle } from "@/slides/slide-title";
import { SlideExample } from "@/slides/slide-example";

export const slides: SlideConfig[] = [
  { id: "title", title: "Introduction", component: SlideTitle, steps: 0 },
  { id: "example", title: "Example", component: SlideExample, steps: 2 },
];
