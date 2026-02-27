/**
 * Generates the index.html used by the PowerVibe dev server and build.
 * Uses an inline module script that re-exports the virtual entry,
 * because Vite's HTML transform doesn't resolve virtual: prefixed src attributes.
 */
export function generateHtml(title: string = "PowerVibe"): string {
  return `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">import "virtual:powervibe-entry"</script>
  </body>
</html>`
}
