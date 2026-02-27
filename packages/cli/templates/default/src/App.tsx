import { SlideThemeProvider, SlideDeck } from "promptslide";
import { slides } from "@/deck-config";
import { theme } from "@/theme";

export default function App() {
  return (
    <SlideThemeProvider theme={theme}>
      <SlideDeck slides={slides} />
    </SlideThemeProvider>
  );
}
