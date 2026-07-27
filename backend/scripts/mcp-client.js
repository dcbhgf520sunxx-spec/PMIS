const { issueClient, listClients, revokeClient } = require('../src/services/mcpCredentialService')
const { pool } = require('../src/db')

function readOption(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? null : args[index + 1]
}

async function main(args = process.argv.slice(2)) {
  const command = args[0]
  if (command === 'create') {
    const result = await issueClient({
      name: readOption(args, '--name'),
      endpointType: readOption(args, '--type'),
      expiresAt: readOption(args, '--expires-at'),
      createdBy: readOption(args, '--created-by') ? Number(readOption(args, '--created-by')) : null,
    })
    console.log(JSON.stringify(result, null, 2))
    console.log('请立即安全保存 token；系统不会再次显示明文凭据。')
    return
  }
  if (command === 'list') {
    console.table(await listClients())
    return
  }
  if (command === 'revoke') {
    const id = Number(args[1])
    if (!Number.isInteger(id) || id <= 0) throw new Error('请提供有效客户端 ID')
    await revokeClient(id)
    console.log(`已吊销 MCP 客户端 ${id}`)
    return
  }
  throw new Error('用法：node scripts/mcp-client.js create --name <名称> --type <query|action> [--expires-at ISO] [--created-by ID] | list | revoke <ID>')
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  }).finally(() => pool.end())
}

module.exports = { main, readOption }
