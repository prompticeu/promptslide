import React from "react"

interface SlideErrorBoundaryProps {
  slideIndex: number
  slideTitle?: string
  children: React.ReactNode
}

interface SlideErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class SlideErrorBoundary extends React.Component<
  SlideErrorBoundaryProps,
  SlideErrorBoundaryState
> {
  state: SlideErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[PromptSlide] Slide ${this.props.slideIndex + 1}${this.props.slideTitle ? ` ("${this.props.slideTitle}")` : ""} crashed:`,
      error,
      errorInfo
    )
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-red-950/20 p-12">
          <div className="mb-4 text-lg font-semibold text-red-400">
            Slide {this.props.slideIndex + 1} Error
            {this.props.slideTitle && (
              <span className="ml-2 font-normal text-red-400/70">
                ({this.props.slideTitle})
              </span>
            )}
          </div>
          <div className="max-w-2xl break-words text-center font-mono text-sm text-red-300/80">
            {this.state.error?.message ?? "Unknown error"}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
