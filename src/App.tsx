import { SlideThemeProvider } from "@/framework/theme-context"
import { SlideDeck } from "@/components/slide-deck"
import { slides } from "@/deck-config"
import { theme } from "@/theme"

export default function App() {
  return (
    <SlideThemeProvider theme={theme}>
      <SlideDeck slides={slides} />
    </SlideThemeProvider>
  )
}
