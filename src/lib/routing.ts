export interface RouteState {
  page: string;
  params: Record<string, any>;
}

export function parseUrlToRoute(pathname: string, search: string): RouteState {
  const searchParams = new URLSearchParams(search);
  const queryObj: Record<string, any> = {};
  searchParams.forEach((val, key) => {
    queryObj[key] = val;
  });

  const pathParts = pathname.split('/').filter(Boolean);

  if (pathParts.length === 0) {
    return { page: 'home', params: queryObj };
  }

  const first = pathParts[0].toLowerCase();

  // Public pages
  if (first === 'home') return { page: 'home', params: queryObj };
  if (first === 'minecraft') return { page: 'minecraft', params: queryObj };
  if (first === 'bot') return { page: 'bot', params: queryObj };
  if (first === 'pricing') return { page: 'pricing', params: queryObj };
  if (first === 'status') return { page: 'status', params: queryObj };
  if (first === 'docs') return { page: 'docs', params: queryObj };
  if (first === 'terms' || first === 'tos') return { page: 'terms', params: { ...queryObj, initialSlug: 'terms' } };
  if (first === 'privacy') return { page: 'privacy', params: { ...queryObj, initialSlug: 'privacy' } };
  if (first === 'acceptable-use' || first === 'aup') return { page: 'acceptable-use', params: { ...queryObj, initialSlug: 'acceptable-use' } };
  if (first === 'legal') {
    const slug = pathParts[1] || 'terms';
    return { page: 'legal', params: { ...queryObj, initialSlug: slug } };
  }

  // Auth pages
  if (first === 'login') return { page: 'login', params: queryObj };
  if (first === 'register') return { page: 'register', params: queryObj };

  // Customer pages
  if (first === 'dashboard') return { page: 'dashboard', params: queryObj };
  if (first === 'marketplace' || first === 'market') return { page: 'marketplace', params: queryObj };
  if (first === 'deploy') return { page: 'deploy', params: queryObj };
  if (first === 'billing') return { page: 'billing', params: queryObj };
  if (first === 'support') return { page: 'support', params: queryObj };
  if (first === 'activity') return { page: 'activity', params: queryObj };
  if (first === 'settings') return { page: 'settings', params: queryObj };
  if (first === 'rewards' || first === 'afk') return { page: 'afk-rewards', params: queryObj };

  // Servers routes: /servers, /servers/new, /servers/:serverId, /servers/:serverId/:tab, /server/:serverId, /server/:serverId/:tab
  if (first === 'servers' || first === 'server') {
    if (first === 'servers' && pathParts.length === 1) {
      return { page: 'servers', params: queryObj };
    }
    if (pathParts[1] === 'new') {
      return { page: 'deploy', params: queryObj };
    }
    const serverId = pathParts[1];
    const initialTab = pathParts[2] || queryObj.tab || queryObj.initialTab || 'console';
    return {
      page: 'server-manage',
      params: { ...queryObj, serverId, initialTab }
    };
  }

  // Admin pages: /admin, /admin/users, /admin/servers, /admin/nodes, etc.
  if (first === 'admin') {
    if (pathParts.length === 1) return { page: 'admin-dashboard', params: queryObj };
    const sub = pathParts[1].toLowerCase();
    if (sub === 'dashboard') return { page: 'admin-dashboard', params: queryObj };
    if (sub === 'users') return { page: 'admin-users', params: queryObj };
    if (sub === 'servers') return { page: 'admin-servers', params: queryObj };
    if (sub === 'products' || sub === 'plans') return { page: 'admin-products', params: queryObj };
    if (sub === 'templates' || sub === 'template') return { page: 'admin-templates', params: queryObj };
    if (sub === 'backups' || sub === 'backup') return { page: 'admin-backups', params: queryObj };
    if (sub === 'nodes') return { page: 'admin-nodes', params: queryObj };
    if (sub === 'monitoring' || sub === 'alerts' || sub === 'health') return { page: 'admin-monitoring', params: queryObj };
    if (sub === 'billing' || sub === 'payments') return { page: 'admin-billing', params: queryObj };

    if (sub === 'coupons') return { page: 'admin-coupons', params: queryObj };
    if (sub === 'announcements') return { page: 'admin-announcements', params: queryObj };
    if (sub === 'ads') return { page: 'admin-ads', params: queryObj };
    if (sub === 'rewards' || sub === 'afk') return { page: 'admin-rewards', params: queryObj };
    if (sub === 'discord' || sub === 'bot') return { page: 'admin-discord', params: queryObj };
    if (sub === 'marketplace' || sub === 'market') return { page: 'admin-marketplace', params: queryObj };
    if (sub === 'appearance' || sub === 'fonts-themes' || sub === 'theme') return { page: 'admin-appearance', params: queryObj };
    if (sub === 'support') return { page: 'admin-support', params: queryObj };
    if (sub === 'audit-logs' || sub === 'logs') return { page: 'admin-audit-logs', params: queryObj };
    if (sub === 'legal' || sub === 'content' || sub === 'legal-pages') return { page: 'admin-legal', params: queryObj };
    if (sub === 'settings') return { page: 'admin-settings', params: queryObj };
    return { page: 'admin-dashboard', params: queryObj };
  }

  // Default fallback
  return { page: 'home', params: queryObj };
}

export function routeToUrl(page: string, params?: Record<string, any>): string {
  const formatQuery = (pObj?: Record<string, any>, excludeKeys: string[] = []) => {
    if (!pObj) return '';
    const sp = new URLSearchParams();
    Object.entries(pObj).forEach(([k, v]) => {
      if (!excludeKeys.includes(k) && v !== undefined && v !== null && v !== '') {
        sp.set(k, String(v));
      }
    });
    const s = sp.toString();
    return s ? `?${s}` : '';
  };

  switch (page) {
    case 'home': return `/${formatQuery(params)}`;
    case 'minecraft': return `/minecraft${formatQuery(params)}`;
    case 'bot': return `/bot${formatQuery(params)}`;
    case 'pricing': return `/pricing${formatQuery(params)}`;
    case 'status': return `/status${formatQuery(params)}`;
    case 'docs': return `/docs${formatQuery(params)}`;
    case 'terms': return `/terms${formatQuery(params)}`;
    case 'privacy': return `/privacy${formatQuery(params)}`;
    case 'acceptable-use': return `/acceptable-use${formatQuery(params)}`;
    case 'legal': return `/legal${params?.initialSlug ? `/${params.initialSlug}` : ''}${formatQuery(params, ['initialSlug'])}`;
    case 'login': return `/login${formatQuery(params)}`;
    case 'register': return `/register${formatQuery(params)}`;

    case 'dashboard': return `/dashboard${formatQuery(params)}`;
    case 'marketplace': return `/marketplace${formatQuery(params)}`;
    case 'servers': return `/servers${formatQuery(params)}`;
    case 'deploy': return `/servers/new${formatQuery(params)}`;
    case 'server-manage': {
      const sId = params?.serverId;
      const tab = params?.initialTab || params?.tab;
      if (sId && tab && tab !== 'console') {
        return `/servers/${sId}/${tab}${formatQuery(params, ['serverId', 'initialTab', 'tab'])}`;
      } else if (sId) {
        return `/servers/${sId}${formatQuery(params, ['serverId', 'initialTab', 'tab'])}`;
      }
      return `/servers${formatQuery(params)}`;
    }
    case 'billing': return `/billing${formatQuery(params)}`;
    case 'support': return `/support${formatQuery(params)}`;
    case 'activity': return `/activity${formatQuery(params)}`;
    case 'settings': return `/settings${formatQuery(params)}`;
    case 'afk-rewards': return `/rewards${formatQuery(params)}`;

    case 'admin-dashboard': return `/admin${formatQuery(params)}`;
    case 'admin-users': return `/admin/users${formatQuery(params)}`;
    case 'admin-servers': return `/admin/servers${formatQuery(params)}`;
    case 'admin-products': return `/admin/products${formatQuery(params)}`;
    case 'admin-templates': return `/admin/templates${formatQuery(params)}`;
    case 'admin-backups': return `/admin/backups${formatQuery(params)}`;
    case 'admin-nodes': return `/admin/nodes${formatQuery(params)}`;
    case 'admin-monitoring': return `/admin/monitoring${formatQuery(params)}`;
    case 'admin-billing': return `/admin/billing${formatQuery(params)}`;

    case 'admin-coupons': return `/admin/coupons${formatQuery(params)}`;
    case 'admin-announcements': return `/admin/announcements${formatQuery(params)}`;
    case 'admin-ads': return `/admin/ads${formatQuery(params)}`;
    case 'admin-rewards': return `/admin/rewards${formatQuery(params)}`;
    case 'admin-discord': return `/admin/discord${formatQuery(params)}`;
    case 'admin-marketplace': return `/admin/marketplace${formatQuery(params)}`;
    case 'admin-appearance': return `/admin/appearance${formatQuery(params)}`;
    case 'admin-legal': return `/admin/legal${formatQuery(params)}`;
    case 'admin-support': return `/admin/support${formatQuery(params)}`;
    case 'admin-audit-logs': return `/admin/audit-logs${formatQuery(params)}`;
    case 'admin-settings': return `/admin/settings${formatQuery(params)}`;

    default:
      return `/${formatQuery(params)}`;
  }
}
