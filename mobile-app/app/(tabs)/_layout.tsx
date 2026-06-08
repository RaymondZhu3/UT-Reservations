import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                headerShown: false,
                tabBarButton: HapticTab,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => 
                        <IconSymbol size={28} name="house.fill" color={color} />,
                }}
            />
            <Tabs.Screen
                name="courts"
                options={{
                    title: 'Courts',
                    tabBarIcon: ({ color }) => 
                        <IconSymbol size={28} name="calendar.badge.plus" color={color} />,
                }}
            />
            <Tabs.Screen
                name="studyrooms"
                options={{
                    title: 'Rooms',
                    tabBarIcon: ({ color }) => 
                        <IconSymbol size={28} name="calendar.badge.plus" color={color} />,
                }}
            />
            <Tabs.Screen
                name="myreservations"
                options={{
                    title: 'My Reservations',
                    tabBarIcon: ({ color }) => 
                        <IconSymbol size={28} name="calendar.badge.plus" color={color} />,
                }}
            />
        </Tabs>
    );
}