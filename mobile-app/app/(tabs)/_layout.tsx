import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Type } from '@/constants/theme';

// All three glyphs are outline symbols, with the orange tint carrying
// selection. SF Symbols has no `calendar.fill`, so filling on select would mix
// two solid glyphs with one outlined one.
export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                // Brand orange. The app is light-only; nothing here follows
                // the system colour scheme.
                tabBarActiveTintColor: Brand.orange,
                tabBarInactiveTintColor: Brand.inkFaint,
                tabBarLabelStyle: Type.micro,
                headerShown: false,
                tabBarButton: HapticTab,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) =>
                        <IconSymbol size={28} name="house" color={color} />,
                }}
            />
            <Tabs.Screen
                name="courts"
                options={{
                    title: 'Courts',
                    tabBarIcon: ({ color }) =>
                        <IconSymbol size={28} name="sportscourt" color={color} />,
                }}
            />
            <Tabs.Screen
                name="myreservations"
                options={{
                    // The screen header says "My Reservations"; a tab label this
                    // long gets shrunk by iOS.
                    title: 'Reservations',
                    tabBarIcon: ({ color }) =>
                        <IconSymbol size={28} name="calendar" color={color} />,
                }}
            />
        </Tabs>
    );
}
