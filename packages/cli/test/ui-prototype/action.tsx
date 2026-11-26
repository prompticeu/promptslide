import { Button } from "@base-ui/react/button"
import { cva } from "class-variance-authority"

import "./theme.css"
const button = cva("ps-probe-button", { variants: { selected: { true: "ps-probe-selected" } } })
export function Action({ selected = false }: { selected?: boolean }) {
  return (
    <Button aria-label="Edit slide" className={button({ selected })}>
      ✎
    </Button>
  )
}
