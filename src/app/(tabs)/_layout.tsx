import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="event-detail" options={{ href: null }} />
    </Tabs>
  );
}