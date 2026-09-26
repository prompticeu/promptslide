import { SlideThemeProvider, SlideDeck, useAnnotations } from "promptslide"

import { slides } from "@/deck-config"
import { theme } from "@/theme"

export default function App() {
  const { annotations, addAnnotation, deleteAnnotation, updateAnnotation } = useAnnotations(slides)

  return (
    <SlideThemeProvider theme={theme}>
      <SlideDeck
        slides={slides}
        annotations={annotations}
        onAnnotationAdd={addAnnotation}
        onAnnotationDelete={deleteAnnotation}
        onAnnotationUpdate={updateAnnotation}
      />
    </SlideThemeProvider>
  )
}
