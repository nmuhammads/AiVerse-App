import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { Settings, Bot, Bell } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useUserStore } from '../../store/userStore';
import { api } from '../../lib/api';

export function Header() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user, setUser } = useUserStore();

    useEffect(() => {
        const fetchUser = async () => {
            if (!user?.id) return;
            try {
                const userData = await api.get<{
                    user_id: number;
                    username: string;
                    first_name: string;
                    last_name?: string;
                    avatar_url?: string;
                }>(`/user/info/${user.id}`);

                if (userData) {
                    setUser({
                        ...user,
                        firstName: userData.first_name,
                        lastName: userData.last_name,
                        avatarUrl: userData.avatar_url,
                        username: userData.username
                    });
                }
            } catch (e) {
                console.error('Failed to fetch user in Header', e);
            }
        };

        fetchUser();
    }, [user?.id]);

    const displayName = user.firstName || user.username || 'Guest';
    const avatarUrl = user.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.username || 'guest'}`;

    const handlePress = (action: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action();
    };

    // Calculate top offset similar to Mini App
    // platform === 'ios' ? '2px' : (platform === 'android' ? '32px' : '12px')
    // In RN, we rely on insets.top, but we can add small padding.
    const topOffset = Platform.OS === 'android' ? 12 : 2;

    return (
        <View
            style={[
                styles.container,
                { top: insets.top + topOffset }
            ]}
            pointerEvents="box-none"
        >
            <BlurView
                intensity={80}
                tint="dark"
                style={styles.pill}
            >
                <View style={styles.pillContent}>
                    {/* Centered Content Group */}
                    <View style={styles.centerGroup}>
                        <Text style={styles.displayName}>{displayName}</Text>

                        <Link href="/profile" asChild>
                            <TouchableOpacity style={styles.avatarButton}>
                                <Image
                                    source={{ uri: avatarUrl }}
                                    style={styles.avatar}
                                />
                            </TouchableOpacity>
                        </Link>

                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => handlePress(() => { })}
                        >
                            <Bell size={20} color="#a1a1aa" />
                            {/* Notification Badge could go here */}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.botButton}
                            onPress={() => handlePress(() => { })}
                        >
                            <LinearGradient
                                colors={['rgba(124, 58, 237, 0.2)', 'rgba(79, 70, 229, 0.2)']}
                                style={styles.botGradient}
                            >
                                <Bot size={16} color="#a78bfa" />
                            </LinearGradient>
                        </TouchableOpacity>

                        <Link href="/settings" asChild>
                            <TouchableOpacity style={styles.settingsButton}>
                                <Settings size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 50,
        // Removed alignItems: 'center' to allow full width
    },
    pill: {
        borderRadius: 9999,
        overflow: 'hidden',
        marginHorizontal: 8, // mx-2 equivalent
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    pillContent: {
        height: 48,
        // paddingHorizontal: 16, // Not strictly needed if we center via flex
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative', // To allow absolute positioning if needed, or just standard flex center
        width: '100%',
    },
    centerGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    displayName: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
        marginRight: 4,
    },
    avatarButton: {
        height: 32,
        width: 32,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#7c3aed', // ring-violet-600
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    iconButton: {
        padding: 8,
        borderRadius: 16,
    },
    botButton: {
        height: 32,
        width: 32,
        borderRadius: 6,
        overflow: 'hidden',
    },
    botGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsButton: {
        height: 32,
        width: 32,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
