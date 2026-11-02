import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Disclosure row: title with a chevron; content appears below when open.
export function Collapsible({
  children,
  title,
  initiallyOpen = false,
}: PropsWithChildren & { title: string; initiallyOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const theme = useTheme();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={({ pressed }) => [styles.heading, pressed && styles.pressed]}
        onPress={() => setIsOpen((value) => !value)}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
          {title}
        </ThemedText>
        <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={18} color={theme.textTertiary} />
        </View>
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.content}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  title: { flex: 1 },
  pressed: { opacity: 0.6 },
  content: { marginTop: Spacing.two },
});
