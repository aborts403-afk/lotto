import { Link } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useWideWeb, WEB_BOTTOM_BAR, WEB_TOP_BAR } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { SITE_NAME } from '@/lib/site';

const TABS: { name: string; href: '/' | '/generate' | '/diagnose' | '/my' | '/stats'; label: string; icon: IconName }[] = [
  { name: 'home', href: '/', label: '홈', icon: 'home' },
  { name: 'generate', href: '/generate', label: '번호', icon: 'dice' },
  { name: 'diagnose', href: '/diagnose', label: '진단', icon: 'diagnose' },
  { name: 'my', href: '/my', label: '내 번호', icon: 'ticket' },
  { name: 'stats', href: '/stats', label: '기록', icon: 'chart' },
];

// Phones: bottom tab bar with icons, like the app. Desktop: top bar with the brand.
export default function AppTabs() {
  const wide = useWideWeb();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        {wide ? (
          <TopBar>
            {/* The brand on the left links home, so the home tab is registered without a button. */}
            {TABS.map((t) =>
              t.name === 'home' ? (
                <TabTrigger key={t.name} name={t.name} href={t.href} style={styles.hidden} />
              ) : (
                <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
                  <TopButton>{t.label}</TopButton>
                </TabTrigger>
              ),
            )}
          </TopBar>
        ) : (
          <BottomBar>
            {TABS.map((t) => (
              <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
                <BottomButton icon={t.icon}>{t.label}</BottomButton>
              </TabTrigger>
            ))}
          </BottomBar>
        )}
      </TabList>
    </Tabs>
  );
}

// `ref` is typed as a component type in TabTriggerSlotProps and does not fit Pressable; it is not needed here.
function BottomButton({ children, isFocused, icon, ref: _ref, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.text : theme.textTertiary;
  return (
    <Pressable {...props} style={({ pressed }) => [styles.bottomButton, pressed && styles.pressed]}>
      <Icon name={icon} size={24} color={color} />
      <ThemedText type="caption" style={[styles.bottomLabel, { color }, isFocused && styles.bold]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function BottomBar(props: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      {...props}
      style={[
        styles.bottomBar,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          paddingBottom: insets.bottom,
          height: WEB_BOTTOM_BAR + insets.bottom,
        },
      ]}
    />
  );
}

function TopButton({ children, isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.topButton,
        isFocused && { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: isFocused ? theme.text : theme.textTertiary }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function TopBar(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={[styles.topBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.topInner}>
        <Link href="/" style={styles.brand}>
          <ThemedText type="heading">{SITE_NAME}</ThemedText>
        </Link>
        <View style={styles.topTabs}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: 'fixed' as 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  bottomButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: WEB_BOTTOM_BAR },
  bottomLabel: { fontSize: 11, lineHeight: 14 },
  bold: { fontWeight: '700' },
  topBar: {
    position: 'fixed' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: WEB_TOP_BAR,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  topInner: {
    width: '100%',
    maxWidth: MaxContentWidth + Spacing.five * 2,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: { marginRight: 'auto' },
  topTabs: { flexDirection: 'row', gap: 4 },
  topButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.sm },
  pressed: { opacity: 0.6 },
  hidden: { display: 'none' },
});
