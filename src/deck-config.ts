import type { SlideConfig } from "@/framework/types"
import { SlideTitle } from "@/slides/slide-title"
import { SlideProblem } from "@/slides/slide-problem"
import { SlideSolution } from "@/slides/slide-solution"
import { SlideHowItWorks } from "@/slides/slide-how-it-works"
import { SlideFeatures } from "@/slides/slide-features"
import { SlideTechStack } from "@/slides/slide-tech-stack"
import { SlideGetStarted } from "@/slides/slide-get-started"

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideProblem, steps: 3 },
  { component: SlideSolution, steps: 3 },
  { component: SlideHowItWorks, steps: 4 },
  { component: SlideFeatures, steps: 2 },
  { component: SlideTechStack, steps: 1 },
  { component: SlideGetStarted, steps: 0 },
]
