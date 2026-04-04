/**
 * Bridge between request_user_upload MCP tool and HTTP upload handler.
 *
 * The tool creates a pending promise via waitForUserUpload().
 * The HTTP handler resolves it via completeUserUpload() when the file arrives.
 */

/** @type {Map<string, { resolve: (result: any) => void }>} */
const pendingUserUploads = new Map()

/**
 * Wait for a user upload to complete via the browser upload page.
 * Returns a promise that resolves with the upload result.
 *
 * @param {string} uploadId
 * @returns {Promise<{ path: string, size: number }>}
 */
export function waitForUserUpload(uploadId) {
  return new Promise((resolve) => {
    pendingUserUploads.set(uploadId, { resolve })
  })
}

/**
 * Resolve a pending user upload. Called by the HTTP upload handler.
 *
 * @param {string} uploadId
 * @param {{ path: string, size: number }} result
 */
export function completeUserUpload(uploadId, result) {
  const pending = pendingUserUploads.get(uploadId)
  if (pending) {
    pending.resolve(result)
    pendingUserUploads.delete(uploadId)
  }
}
