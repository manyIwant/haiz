export type BackState = { inside: boolean; search: boolean; inspector: boolean; lens: boolean; canGoBack: boolean; route: string };
export function backAction(s: BackState) {
  if (s.inside) return 'painting';
  if (s.search) return 'search';
  if (s.inspector) return 'inspector';
  if (s.lens) return 'lens';
  if (s.canGoBack) return 'history';
  if (s.route !== 'today') return 'home';
  return 'minimize';
}
