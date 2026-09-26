import type { SlideConfig } from "promptslide"

import { SlideFeatures } from "@/slides/slide-features"
import { SlideGetStarted } from "@/slides/slide-get-started"
import { SlideHowItWorks } from "@/slides/slide-how-it-works"
import { SlideProblem } from "@/slides/slide-problem"
import { SlideSolution } from "@/slides/slide-solution"
import { SlideTechStack } from "@/slides/slide-tech-stack"
import { SlideTitle } from "@/slides/slide-title"

export const slides: SlideConfig[] = [
  { id: "title", component: SlideTitle, steps: 0 },
  { id: "problem", component: SlideProblem, steps: 1 },
  { id: "solution", component: SlideSolution, steps: 1 },
  { id: "how-it-works", component: SlideHowItWorks, steps: 3 },
  { id: "features", component: SlideFeatures, steps: 0 },
  { id: "tech-stack", component: SlideTechStack, steps: 0 },
  { id: "get-started", component: SlideGetStarted, steps: 0 }
]
