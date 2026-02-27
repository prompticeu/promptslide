import type { SlideConfig } from "@promptslide/core"

import { SlideFeatures } from "@/slides/slide-features"
import { SlideGetStarted } from "@/slides/slide-get-started"
import { SlideHowItWorks } from "@/slides/slide-how-it-works"
import { SlideProblem } from "@/slides/slide-problem"
import { SlideSolution } from "@/slides/slide-solution"
import { SlideTechStack } from "@/slides/slide-tech-stack"
import { SlideTitle } from "@/slides/slide-title"

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 1 },
  { component: SlideProblem, steps: 2 },
  { component: SlideSolution, steps: 2 },
  { component: SlideHowItWorks, steps: 4 },
  { component: SlideFeatures, steps: 1 },
  { component: SlideTechStack, steps: 1 },
  { component: SlideGetStarted, steps: 1 }
]
