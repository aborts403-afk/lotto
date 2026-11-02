import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

// 홈 (with the round pages) · 번호 · 진단 · 내 번호 · 기록 (stats, stores, simulator).
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.backgroundElement}
      indicatorColor={colors.primarySoft}
      iconColor={{ default: colors.textTertiary, selected: colors.primary }}
      labelStyle={{ default: { color: colors.textTertiary }, selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="generate">
        <NativeTabs.Trigger.Label>번호</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'dice', selected: 'dice.fill' }} md="casino" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diagnose">
        <NativeTabs.Trigger.Label>진단</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'stethoscope', selected: 'stethoscope' }} md="troubleshoot" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="my">
        <NativeTabs.Trigger.Label>내 번호</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ticket', selected: 'ticket.fill' }} md="confirmation_number" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>기록</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
