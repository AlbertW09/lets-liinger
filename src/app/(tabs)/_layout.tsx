import { Tabs } from 'expo-router';

// Only the real tab-bar screens live here now (index, calendar, map, profile,
// messages, implicitly registered from their files). Everything else —
// user, connections, event-detail, dm-thread, notifications, search,
// insights, edit-profile — is a pushed detail/modal screen and lives in the
// root Stack (src/app/) instead, so it gets a real back-stack.
export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false }} />;
}
