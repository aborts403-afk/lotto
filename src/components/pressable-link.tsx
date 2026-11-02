import { Link, type Href } from 'expo-router';
import { useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

// A link styled as a tappable surface. `<Link asChild>` on web drops function styles
// (`style={({ pressed }) => ...}`), so pressed feedback is tracked with state instead.
export function PressableLink({
  href,
  style,
  children,
  ...rest
}: PropsWithChildren<{ href: Href; style?: StyleProp<ViewStyle> } & Omit<PressableProps, 'style' | 'children'>>) {
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        {...rest}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        // Link merges styles only one level deep on web, so pass a flat object.
        style={StyleSheet.flatten([style, pressed && { opacity: 0.7 }])}>
        {children}
      </Pressable>
    </Link>
  );
}
