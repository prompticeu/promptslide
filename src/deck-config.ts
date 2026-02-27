import type { SlideConfig } from "promptslide"

import { SlideFeatures } from "@/slides/slide-features"
import { SlideGetStarted } from "@/slides/slide-get-started"
import { SlideHowItWorks } from "@/slides/slide-how-it-works"
import { SlideProblem } from "@/slides/slide-problem"
import { SlideSolution } from "@/slides/slide-solution"
import { SlideTechStack } from "@/slides/slide-tech-stack"
import { SlideTitle } from "@/slides/slide-title"

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideProblem, steps: 3 },
  { component: SlideSolution, steps: 3 },
  { component: SlideHowItWorks, steps: 4 },
  { component: SlideFeatures, steps: 2 },
  { component: SlideTechStack, steps: 1 },
  { component: SlideGetStarted, steps: 0 }
]
