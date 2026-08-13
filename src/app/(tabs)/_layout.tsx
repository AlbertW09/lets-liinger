import { Tabs } from 'expo-router';
import { Image } from 'react-native';

// Only the real tab-bar screens live here now (index, calendar, map, profile,
// messages, implicitly registered from their files). Everything else —
// user, connections, event-detail, dm-thread, notifications, search,
// insights, edit-profile — is a pushed detail/modal screen and lives in the
// root Stack (src/app/) instead, so it gets a real back-stack.
//
// All five are declared explicitly (even the ones with no custom options)
// because <Tabs.Screen> declaration order is what controls left-to-right
// tab order — leaving any out lets expo-router register them automatically
// in file order instead, ahead of the declared ones.
const TAB_ICON_SIZE = 28;

// Only the real tab-bar screens live here now (index, calendar, map, profile,
// messages, implicitly registered from their files). Everything else —
// user, connections, event-detail, dm-thread, notifications, search,
// insights, edit-profile, settings, legal, moderation — is a pushed
// detail/modal screen and lives in the root Stack (src/app/) instead, so it
// gets a real back-stack.
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'home',
          tabBarIcon: () => (
            <Image
              source={require('@/assets/images/tabIcons/home.png')}
              style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: () => (
            <Image
              source={require('@/assets/images/tabIcons/calendar.png')}
              style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: () => (
            <Image
              source={require('@/assets/images/tabIcons/map.png')}
              style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: () => (
            <Image
              source={require('@/assets/images/tabIcons/profile.png')}
              style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: () => (
            <Image
              source={require('@/assets/images/tabIcons/messages.png')}
              style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
