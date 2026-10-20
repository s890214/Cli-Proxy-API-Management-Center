/**
 * 配额自动刷新设置条。
 *
 * - 全局开关 + 间隔，作用于后端的定时刷新任务；
 * - 全局关闭时，卡片的单项开关置灰（以全局为准）；
 * - 后端只在「距上次刷新之后有过代理请求」时才真正去查上游，
 *   手动刷新按钮不受该限制。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  quotaAutoRefreshApi,
  type QuotaAutoRefreshPatch,
  type QuotaAutoRefreshState,
} from '@/services/api/quotaAutoRefresh';
import styles from './QuotaAutoRefreshBar.module.scss';

export type QuotaAutoRefreshBarProps = {
  /** 状态变化时回调，供页面控制卡片单项开关的可用性 */
  onChange?: (state: QuotaAutoRefreshState | null) => void;
};

const INTERVAL_MIN = 1;
const INTERVAL_MAX = 60;

function parseMinutes(interval: string | undefined): number {
  const match = /^(\d+(?:\.\d+)?)\s*(m|s|h)?$/i.exec((interval ?? '').trim());
  if (!match) return 5;
  const value = Number(match[1]);
  const unit = (match[2] ?? 'm').toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return 5;
  if (unit === 's') return Math.max(INTERVAL_MIN, Math.round(value / 60));
  if (unit === 'h') return Math.min(INTERVAL_MAX, Math.round(value * 60));
  return Math.min(INTERVAL_MAX, Math.max(INTERVAL_MIN, Math.round(value)));
}

function formatLastRun(value: string | undefined): string {
  if (!value) return '尚未执行';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未执行';
  return date.toLocaleString();
}

export function QuotaAutoRefreshBar({ onChange }: QuotaAutoRefreshBarProps) {
  const [state, setState] = useState<QuotaAutoRefreshState | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyState = useCallback(
    (next: QuotaAutoRefreshState | null) => {
      setState(next);
      onChange?.(next);
      if (next) {
        setEnabled(next.enabled);
        setMinutes(parseMinutes(next.interval));
      }
    },
    [onChange]
  );

  const load = useCallback(async () => {
    try {
      const next = await quotaAutoRefreshApi.get();
      applyState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取自动刷新设置失败');
    }
  }, [applyState]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!state) return false;
    return state.enabled !== enabled || parseMinutes(state.interval) !== minutes;
  }, [state, enabled, minutes]);

  const save = useCallback(async () => {
    const patch: QuotaAutoRefreshPatch = {
      enabled,
      interval: `${minutes}m`,
    };
    setSaving(true);
    try {
      const next = await quotaAutoRefreshApi.update(patch);
      applyState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [enabled, minutes, applyState]);

  const statusText = useMemo(() => {
    if (!state) return '读取中…';
    if (!state.enabled) return '已关闭：定时任务不会刷新配额';
    if (state.skipped) return '上轮跳过：期间没有代理请求';
    if (state.last_error) return `上轮出错：${state.last_error}`;
    return `上次执行：${formatLastRun(state.last_run)}`;
  }, [state]);

  return (
    <section className={styles.bar}>
      <div className={styles.left}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span className={styles.toggleLabel}>配额自动刷新</span>
        </label>

        <span className={styles.interval}>
          每
          <input
            type="number"
            min={INTERVAL_MIN}
            max={INTERVAL_MAX}
            value={minutes}
            disabled={!enabled}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              setMinutes(Math.min(INTERVAL_MAX, Math.max(INTERVAL_MIN, Math.round(next))));
            }}
            className={styles.intervalInput}
          />
          分钟
        </span>

        <span className={styles.status}>{statusText}</span>
      </div>

      <div className={styles.right}>
        {error ? <span className={styles.error}>{error}</span> : null}
        <Button variant="secondary" onClick={() => void load()} disabled={saving}>
          重新读取
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </div>
    </section>
  );
}

/** 供卡片判断：全局开启 + 本项目未被单独关闭 */
export function isAutoRefreshActiveFor(
  state: QuotaAutoRefreshState | null,
  authIndex: string | undefined
): boolean {
  if (!state || !state.enabled || !authIndex) return false;
  return !state.disabled_indices?.includes(authIndex);
}
