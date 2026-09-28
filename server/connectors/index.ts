/**
 * 来源连接器注册表。
 *
 * 新增来源的步骤：
 * 1. 在本目录下新建连接器文件，实现 SourceConnector。
 * 2. 在下面的数组里注册。
 * 3. 在 server/sources.ts 里补一条用户可见的来源描述，状态必须与 checkConfig 的真实结果一致。
 * 4. 更新交接手册第 8 节和第 12 节。
 */
import { githubDiscoveryConnector } from './github.js'
import type { ConnectorConfigStatus, SourceConnector } from './types.js'

export const connectors: SourceConnector[] = [
  githubDiscoveryConnector,
]

export function findConnector(id: string) {
  return connectors.find((connector) => connector.id === id)
}

export type ConnectorStatus = { id: string; label: string; kind: string } & ConnectorConfigStatus

/** 供 /api/sources 做状态对账，避免来源表写出“已实现但实际没有”的假状态。 */
export async function connectorStatuses(): Promise<ConnectorStatus[]> {
  return Promise.all(connectors.map(async (connector) => {
    let status: ConnectorConfigStatus
    try {
      status = await connector.checkConfig()
    } catch {
      status = { ready: false, message: '连接器自检失败，请查看服务端日志。' }
    }
    return { id: connector.id, label: connector.label, kind: connector.kind, ...status }
  }))
}

export type { Candidate, FetchCandidatesInput, FetchCandidatesResult, SourceConnector, ToolCard } from './types.js'
