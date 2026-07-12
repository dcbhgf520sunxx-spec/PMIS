function envelope(res, status, code, message, data = null, extra = {}) {
  return res.status(status).json({
    code,
    message,
    data,
    ...extra,
    requestId: res.locals?.requestId
  })
}

function ok(res, data, message = 'success') {
  return envelope(res, 200, 0, message, data)
}

function fail(res, status, code, message, data = null) {
  return envelope(res, status, code, message, data)
}

function failField(res, field, message, status = 400, code = 400) {
  return envelope(res, status, code, '请检查表单字段', null, {
    fieldErrors: { [field]: [message] }
  })
}

function isEnvelope(body) {
  return body && typeof body === 'object' && typeof body.code === 'number' && Object.hasOwn(body, 'data')
}

function attachResponseHelpers(req, res, next) {
  const json = res.json.bind(res)

  res.ok = (data, message = 'success') => ok(res, data, message)
  res.fail = (status, code, message, data = null) => fail(res, status, code, message, data)
  res.json = (body) => {
    if (isEnvelope(body) && body.requestId === undefined) {
      return json({ ...body, requestId: res.locals?.requestId })
    }
    return json(body)
  }

  next()
}

module.exports = { attachResponseHelpers, ok, fail, failField }
