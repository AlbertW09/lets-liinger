import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';

export default function AppTabs() {
  return (
    <Tabs>
      {/* 1. Renders your actual site layout (Logo, Search, Flyers) */}
      <TabSlot style={{ height: '100%' }} />

      {/* 2. Hidden TabList to register your routes without showing up on screen */}
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="home" href="/" />
      </TabList>
    </Tabs>
  );
}