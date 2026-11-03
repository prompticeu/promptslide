import { createContext, useContext, useMemo } from "react"

interface AnimationContextValue {
  /** Current animation step (0 = no animations shown yet) */
  currentStep: number
  /** Total animation steps in this slide (declared in slide config) */
  totalSteps: number
  /** When true, all animation steps should be visible (used for backward navigation) */
  showAllAnimations: boolean
  isExporting?: boolean
}

const AnimationContext = createContext<AnimationContextValue>({
  currentStep: 0,
  totalSteps: 0,
  showAllAnimations: false
})

interface AnimationProviderProps {
  children: React.ReactNode
  /** Current animation step (0 = no animations shown yet) */
  currentStep: number
  /** Total animation steps declared in slide config */
  totalSteps: number
  /** When true, show all animations regardless of currentStep (for backward navigation) */
  showAllAnimations?: boolean
  /** Render a deterministic still state without motion effects. */
  isExporting?: boolean
}

/**
 * Provides animation context to child components.
 *
 * The totalSteps is now passed from parent (declared in slide config)
 * rather than discovered at runtime, eliminating race conditions.
 */
export function AnimationProvider({
  children,
  currentStep,
  totalSteps,
  showAllAnimations = false,
  isExporting = false
}: AnimationProviderProps) {
  const value = useMemo(
    () => ({
      currentStep,
      totalSteps,
      showAllAnimations,
      isExporting
    }),
    [currentStep, totalSteps, showAllAnimations, isExporting]
  )

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
}

export function useAnimationContext() {
  return useContext(AnimationContext)
}
