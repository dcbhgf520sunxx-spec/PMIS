const accessLogService = require('../services/accessLogService')

exports.list = async (req, res) => {
  try {
    const rows = await accessLogService.listAccessLogs(req.query)
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}
