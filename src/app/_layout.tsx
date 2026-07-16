import * as SplashScreen from 'expo-splash-screen';



import { Tabs } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import React from 'react';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <React.Fragment>
      <StatusBar style="auto"/>
      <Tabs />
    </React.Fragment>
  );
}
