import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const PRIMARY = '#208AEF';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: variant === 'primary' ? PRIMARY : theme.backgroundSelected },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <ThemedText type="smallBold" style={variant === 'primary' ? styles.primaryText : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 12, paddingHorizontal: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  primaryText: { color: '#fff' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
