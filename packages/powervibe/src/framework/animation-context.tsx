import { createContext, useContext, useMemo } from "react"

interface AnimationContextValue {
  currentStep: number
  totalSteps: number
  showAllAnimations: boolean
}

const AnimationContext = createContext<AnimationContextValue>({
  currentStep: 0,
  totalSteps: 0,
  showAllAnimations: false
})

interface AnimationProviderProps {
  children: React.ReactNode
  currentStep: number
  totalSteps: number
  showAllAnimations?: boolean
}

export function AnimationProvider({
  children,
  currentStep,
  totalSteps,
  showAllAnimations = false
}: AnimationProviderProps) {
  const value = useMemo(
    () => ({
      currentStep,
      totalSteps,
      showAllAnimations
    }),
    [currentStep, totalSteps, showAllAnimations]
  )

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  )
}

export function useAnimationContext() {
  return useContext(AnimationContext)
}
