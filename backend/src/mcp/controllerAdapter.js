function invokeController(handler, context, input = {}) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (body) => {
      if (settled) return
      settled = true
      resolve(body)
    }
    const res = {
      locals: { requestId: context.requestId },
      statusCode: 200,
      status(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        finish(body?.requestId === undefined ? { ...body, requestId: context.requestId } : body)
        return this
      },
      send(body) {
        finish(body)
        return this
      },
      setHeader() {},
      getHeader() { return undefined },
    }
    const headers = Object.fromEntries(
      Object.entries(input.headers || {}).map(([key, value]) => [key.toLowerCase(), value])
    )
    const req = {
      user: { id: context.user.id, employeeNo: context.user.employeeNo },
      params: input.params || {},
      query: input.query || {},
      body: input.body || {},
      file: input.file,
      files: input.files,
      ip: context.ip,
      requestId: context.requestId,
      headers,
      get(name) {
        return headers[String(name || '').toLowerCase()]
      },
    }
    Promise.resolve(handler(req, res))
      .then(() => {
        if (!settled) reject(new Error('业务处理器未返回结果'))
      })
      .catch(reject)
  })
}

module.exports = { invokeController }
