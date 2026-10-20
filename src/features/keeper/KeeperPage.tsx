import { useTranslation } from 'react-i18next';
import styles from './KeeperPage.module.scss';

/**
 * 把独立运行的 CPA Usage Keeper 以内嵌页面的方式并入 CPAMC，作为一级菜单。
 *
 * Keeper 与 CPA 通常部署在同一台主机上（同容器内的 8080 端口），
 * 所以这里用 loopback 主机名 + 固定端口推导地址，避免写死 IP。
 * 需要 Keeper 侧放开 frame-ancestors（设置 CPA_PUBLIC_URL 即可）。
 */
function resolveKeeperUrl(): string {
  const override = (import.meta.env.VITE_KEEPER_URL as string | undefined)?.trim();
  if (override) return override;
  // CPA 内置了 /keeper 反代（同源转发到容器内的 Keeper 进程），
  // 用相对路径即可，不依赖宿主 IP 和端口映射；embed=cpamc 是 Keeper 的面板嵌入模式。
  return '/keeper/overview?embed=cpamc';
}

export function KeeperPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.wrap}>
      <iframe
        title={t('nav.keeper')}
        src={resolveKeeperUrl()}
        className={styles.frame}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
