const messageService = require('../services/messageService')

exports.list = async (req, res) => {
  try {
    const rows = await messageService.listMessages(req.user.id, req.query)
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.markRead = async (req, res) => {
  try {
    const result = await messageService.markMessageRead(req.user.id, req.params.id)
    res.json({ code: 0, message: 'success', data: result })
  } catch (err) {
    console.error(err)
    res.status(err.statusCode || 500).json({ code: err.statusCode || 500, message: err.message || '操作失败', data: null })
  }
}

exports.markAllRead = async (req, res) => {
  try {
    const result = await messageService.markAllMessagesRead(req.user.id)
    res.json({ code: 0, message: 'success', data: result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '操作失败', data: null })
  }
}
