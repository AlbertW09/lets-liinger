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
const MESSAGES_ICON_SIZE = 30;
const MESSAGES_ICON_SIZE_FOCUSED = 70;

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarShowLabel: false,
          // Custom icon is already full-color, so no tintColor here (that
          // would flatten it to a solid color instead of showing it as-is).
          tabBarIcon: ({ focused }) => {
            const size = focused ? MESSAGES_ICON_SIZE_FOCUSED : MESSAGES_ICON_SIZE;
            return (
              <Image
                source={require('@/assets/images/tabIcons/messages.png')}
                style={{ width: size, height: size }}
              />
            );
          },
        }}
      />
    </Tabs>
  );
}
