import { Link, type Href } from 'expo-router';
import { type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableLink } from '@/components/pressable-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// White content surface on the gray page. `muted` is the nested surface used inside a card.
export function Card({ children, style, muted }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; muted?: boolean }>) {
  return (
    <ThemedView type={muted ? 'backgroundSelected' : 'backgroundElement'} style={[muted ? styles.muted : styles.card, style]}>
      {children}
    </ThemedView>
  );
}

// A titled group: heading + optional action link on the right, then content.
export function Section({
  title,
  description,
  action,
  children,
  style,
}: PropsWithChildren<{
  title: string;
  description?: string;
  action?: { label: string; href: Href };
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <View style={styles.flex}>
          <ThemedText type="heading">{title}</ThemedText>
          {description && (
            <ThemedText type="caption" themeColor="textTertiary">
              {description}
            </ThemedText>
          )}
        </View>
        {action && (
          <Link href={action.href}>
            <ThemedText type="small" themeColor="textTertiary">
              {action.label} ›
            </ThemedText>
          </Link>
        )}
      </View>
      {children}
    </View>
  );
}

// Tappable row with a chevron; use inside a Card for navigation lists.
export function ListRow({
  title,
  subtitle,
  left,
  right,
  href,
  onPress,
  last,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  href?: Href;
  onPress?: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  const rowStyle = [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }];
  const content = (
    <>
      {left}
      <View style={styles.flex}>
        {typeof title === 'string' ? <ThemedText type="smallBold">{title}</ThemedText> : title}
        {typeof subtitle === 'string' ? (
          <ThemedText type="caption" themeColor="textTertiary">
            {subtitle}
          </ThemedText>
        ) : (
          subtitle
        )}
      </View>
      {right}
      {(href || onPress) && <Icon name="chevronRight" size={16} color={theme.textTertiary} />}
    </>
  );
  if (href) {
    return (
      <PressableLink href={href} style={rowStyle}>
        {content}
      </PressableLink>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

// Small callout for explanations ("당첨 확률은 같아요"), visually quieter than content.
export function Notice({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.backgroundSelected }, style]}>
      <Icon name="info" size={16} color={theme.textTertiary} />
      <View style={styles.flex}>
        {typeof children === 'string' ? (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.noticeText}>
            {children}
          </ThemedText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function Pill({ label, color, soft }: { label: string; color: string; soft?: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: soft ? `${color}1F` : color }]}>
      <ThemedText type="caption" style={{ color: soft ? color : '#fff', fontWeight: '700' }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: Radius.lg, gap: Spacing.three },
  muted: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.two },
  section: { gap: 12, marginTop: Spacing.two },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, paddingHorizontal: Spacing.one },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  pressed: { opacity: 0.6 },
  notice: { flexDirection: 'row', gap: Spacing.two, padding: 12, borderRadius: Radius.md, alignItems: 'flex-start' },
  noticeText: { lineHeight: 18 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, alignSelf: 'flex-start' },
});
