import type { SlideConfig } from "@promptslide/core"
import { SlideTitle } from "@/slides/slide-title"
import { SlideProblem } from "@/slides/slide-problem"
import { SlideSolution } from "@/slides/slide-solution"
import { SlideHowItWorks } from "@/slides/slide-how-it-works"
import { SlideFeatures } from "@/slides/slide-features"
import { SlideTechStack } from "@/slides/slide-tech-stack"
import { SlideGetStarted } from "@/slides/slide-get-started"

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 1 },
  { component: SlideProblem, steps: 2 },
  { component: SlideSolution, steps: 2 },
  { component: SlideHowItWorks, steps: 4 },
  { component: SlideFeatures, steps: 1 },
  { component: SlideTechStack, steps: 1 },
  { component: SlideGetStarted, steps: 1 },
]
