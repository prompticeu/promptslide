/** Open application roots are inspectable without changing document APIs. */
export async function installApplicationQueries(page) {
  await page.addInitScript(() => {
    window.psQuery = selector => {
      const find = root => {
        const result = root.querySelector(selector)
        if (result) return result
        for (const host of root.querySelectorAll("[data-ps-app-host]")) {
          const match = host.shadowRoot && find(host.shadowRoot)
          if (match) return match
        }
        return null
      }
      return find(document)
    }
    window.psActive = () => {
      let element = document.activeElement
      while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
      return element
    }
  })
}
