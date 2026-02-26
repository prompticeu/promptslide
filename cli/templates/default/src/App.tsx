import { SlideBrandingProvider } from "@/framework/slide-layout"
import { SlideDeck } from "@/components/slide-deck"
import { slides } from "@/deck-config"

export default function App() {
  return (
    <SlideBrandingProvider branding={{ name: "{{PROJECT_NAME}}", logoUrl: "/logo.svg" }}>
      <SlideDeck slides={slides} />
    </SlideBrandingProvider>
  )
}
