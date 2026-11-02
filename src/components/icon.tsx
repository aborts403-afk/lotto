import { SymbolView, type SFSymbol } from 'expo-symbols';

// One icon name per meaning, mapped to SF Symbols (iOS) and Material Symbols (Android, web).
const ICONS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  list: { ios: 'list.number', android: 'format_list_numbered', web: 'format_list_numbered' },
  dice: { ios: 'dice.fill', android: 'casino', web: 'casino' },
  ticket: { ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' },
  chart: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  store: { ios: 'storefront.fill', android: 'storefront', web: 'storefront' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  copy: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  bookmark: { ios: 'bookmark', android: 'bookmark_add', web: 'bookmark_add' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  trophy: { ios: 'trophy.fill', android: 'trophy', web: 'trophy' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  tune: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  map: { ios: 'map', android: 'map', web: 'map' },
  diagnose: { ios: 'stethoscope', android: 'troubleshoot', web: 'troubleshoot' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  snow: { ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' },
  grid: { ios: 'square.grid.3x3.fill', android: 'grid_view', web: 'grid_view' },
  text: { ios: 'text.quote', android: 'format_quote', web: 'format_quote' },
  shapes: { ios: 'chart.bar.xaxis', android: 'equalizer', web: 'equalizer' },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  const n = ICONS[name];
  return <SymbolView name={{ ios: n.ios as SFSymbol, android: n.android, web: n.web }} size={size} tintColor={color} />;
}
