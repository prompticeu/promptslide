export function jsonResponse(payload) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payload, null, 2),
    }],
  }
}

export function textResponse(text) {
  return {
    content: [{
      type: "text",
      text,
    }],
  }
}

export function imageResponse(data, mimeType = "image/png") {
  return {
    content: [{
      type: "image",
      data,
      mimeType,
    }],
  }
}

export function appendTextNotice(response, text) {
  return {
    ...response,
    content: [
      ...(response.content || []),
      {
        type: "text",
        text,
      },
    ],
  }
}

export function errorResponse(error, extra = {}) {
  return jsonResponse({
    error: error?.message || String(error),
    ...extra,
  })
}
