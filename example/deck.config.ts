import { defineConfig } from "powervibe"
import { SlideTitle } from "./src/slides/slide-title"
import { SlideProblem } from "./src/slides/slide-problem"
import { SlideSolution } from "./src/slides/slide-solution"
import { SlideHowItWorks } from "./src/slides/slide-how-it-works"
import { SlideFeatures } from "./src/slides/slide-features"
import { SlideTechStack } from "./src/slides/slide-tech-stack"
import { SlideGetStarted } from "./src/slides/slide-get-started"

export default defineConfig({
  branding: { name: "PowerVibe", logoUrl: "/logo.svg" },
  slides: [
    { component: SlideTitle, steps: 0 },
    { component: SlideProblem, steps: 3 },
    { component: SlideSolution, steps: 3 },
    { component: SlideHowItWorks, steps: 4 },
    { component: SlideFeatures, steps: 2 },
    { component: SlideTechStack, steps: 1 },
    { component: SlideGetStarted, steps: 0 },
  ],
})
