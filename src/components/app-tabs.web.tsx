import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>홈</TabButton>
          </TabTrigger>
          <TabTrigger name="round" href="/round" asChild>
            <TabButton>회차</TabButton>
          </TabTrigger>
          <TabTrigger name="generate" href="/generate" asChild>
            <TabButton>번호 생성</TabButton>
          </TabTrigger>
          <TabTrigger name="my" href="/my" asChild>
            <TabButton>내 번호</TabButton>
          </TabTrigger>
          <TabTrigger name="stats" href="/stats" asChild>
            <TabButton>통계</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// `ref` is typed as a component type in TabTriggerSlotProps and does not fit Pressable; it is not needed here.
export function TabButton({ children, isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

// Five tabs and the brand do not fit on a phone-width browser, so narrow screens drop the brand and spread the tabs.
const NARROW = 560;

export function CustomTabList(props: TabListProps) {
  const hydrated = useHydrated();
  const width = useWindowDimensions().width;
  // The static HTML has no window size; render the compact bar until hydrated so phones never overflow.
  const narrow = hydrated ? width < NARROW : true;
  return (
    <View {...props} style={[styles.tabListContainer, narrow && styles.tabListNarrow]}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, narrow && styles.innerNarrow]}>
        {!narrow && (
          <ThemedText type="smallBold" style={styles.brandText}>
            로또 노트
          </ThemedText>
        )}

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  tabListNarrow: {
    padding: Spacing.two,
  },
  innerNarrow: {
    paddingHorizontal: Spacing.one,
    gap: 0,
    justifyContent: 'space-between',
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: 12,
    borderRadius: Spacing.three,
  },
});
