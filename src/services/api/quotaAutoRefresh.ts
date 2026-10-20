/**
 * 配额自动刷新 API
 *
 * 后端把开关、间隔、单账号禁用列表存在独立 JSON 文件里，
 * 不写回 config.yaml。
 */

import { apiClient } from './client';

export type QuotaAutoRefreshSnapshot = {
  plugin_id: string;
  auth_index: string;
  provider: string;
  fetched_at: string;
  error?: string;
  quota?: unknown;
};

export type QuotaAutoRefreshState = {
  enabled: boolean;
  interval: string;
  disabled_indices: string[];
  last_run?: string;
  last_error?: string;
  /** 上一轮因「无请求活动」被跳过时为 true */
  skipped?: boolean;
  /** 最近一次代理请求的时间戳（Unix 秒），0 表示从未收到请求 */
  last_request_at?: number;
  /** 后端固定为 true：定时刷新需要请求活动才会真正执行 */
  activity_required?: boolean;
  /** 设置文件在容器内的路径，便于排查 */
  config_path?: string;
  snapshots: QuotaAutoRefreshSnapshot[];
};

export type QuotaAutoRefreshPatch = {
  enabled?: boolean;
  interval?: string;
  disabled_indices?: string[];
};

export const quotaAutoRefreshApi = {
  get: () => apiClient.get<QuotaAutoRefreshState>('/quota/auto-refresh'),
  update: (patch: QuotaAutoRefreshPatch) =>
    apiClient.put<QuotaAutoRefreshState>('/quota/auto-refresh', patch),
  refreshNow: () => apiClient.post<{ status: string }>('/quota/auto-refresh/now', {}),
};
