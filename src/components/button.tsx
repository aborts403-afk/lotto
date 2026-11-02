import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  style,
  accessibilityLabel,
}: {
  label?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tonal' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const bg = { primary: theme.primary, secondary: theme.backgroundSelected, tonal: theme.primarySoft, ghost: 'transparent' }[
    variant
  ];
  const fg = { primary: theme.onPrimary, secondary: theme.text, tonal: theme.primary, ghost: theme.textSecondary }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        !label && styles.iconOnly,
        { backgroundColor: bg },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} />}
      {label && (
        <ThemedText
          type={size === 'sm' ? 'caption' : 'smallBold'}
          style={[{ color: fg }, size === 'lg' && styles.lgText, size === 'sm' && styles.smText]}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.md },
  sm: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: Radius.sm },
  md: { paddingVertical: 12, paddingHorizontal: Spacing.three },
  lg: { paddingVertical: 16, paddingHorizontal: Spacing.four },
  iconOnly: { paddingHorizontal: 12 },
  lgText: { fontSize: 16, lineHeight: 22 },
  smText: { fontWeight: '700' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.35 },
});
