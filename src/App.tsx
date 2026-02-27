import { SlideBrandingProvider, SlideDeck } from "promptslide"

import { slides } from "@/deck-config"

export default function App() {
  return (
    <SlideBrandingProvider branding={{ name: "PromptSlide", logoUrl: "/logo.svg" }}>
      <SlideDeck slides={slides} />
    </SlideBrandingProvider>
  )
}
