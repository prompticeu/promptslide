import { defineConfig } from "powervibe"
import { SlideTitle } from "./src/slides/slide-title"
import { SlideExample } from "./src/slides/slide-example"

export default defineConfig({
  branding: { name: "{{PROJECT_NAME}}", logoUrl: "/logo.svg" },
  slides: [
    { component: SlideTitle, steps: 0 },
    { component: SlideExample, steps: 2 },
  ],
})
