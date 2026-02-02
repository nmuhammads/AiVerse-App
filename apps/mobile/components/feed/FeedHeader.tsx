import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../theme';
import * as Haptics from 'expo-haptics';

interface FeedHeaderProps {
    sort: 'new' | 'popular';
    feedFilter: 'all' | 'following';
    onSortChange: (sort: 'new' | 'popular') => void;
    onFeedFilterChange: (filter: 'all' | 'following') => void;
    onSearchOpen: () => void;
}

export function FeedHeader({
    sort,
    feedFilter,
    onSortChange,
    onFeedFilterChange,
    onSearchOpen,
}: FeedHeaderProps) {
    const handlePress = (action: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action();
    };

    return (
        <View style={styles.container}>
            <View style={styles.leftContainer}>
                <TouchableOpacity
                    onPress={() => handlePress(() => { onSortChange('new'); onFeedFilterChange('all'); })}
                    style={styles.tabButton}
                >
                    <Text style={[
                        styles.tabText,
                        sort === 'new' && feedFilter === 'all' ? styles.tabTextActive : styles.tabTextInactive
                    ]}>
                        New
                    </Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                    onPress={() => handlePress(() => { onSortChange('popular'); onFeedFilterChange('all'); })}
                    style={styles.tabButton}
                >
                    <Text style={[
                        styles.tabText,
                        sort === 'popular' && feedFilter === 'all' ? styles.tabTextActive : styles.tabTextInactive
                    ]}>
                        Popular
                    </Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                    onPress={() => handlePress(() => onFeedFilterChange('following'))}
                    style={styles.tabButton}
                >
                    <Text style={[
                        styles.tabText,
                        feedFilter === 'following' ? styles.tabTextActive : styles.tabTextInactive
                    ]}>
                        Following
                    </Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.searchButton}
                onPress={() => handlePress(onSearchOpen)}
            >
                <Ionicons name="search" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    tabButton: {
        paddingVertical: spacing.xs,
    },
    tabText: {
        fontSize: 17,
        fontWeight: '600',
    },
    tabTextActive: {
        color: colors.text,
    },
    tabTextInactive: {
        color: colors.textSecondary,
    },
    divider: {
        width: 1,
        height: 16,
        backgroundColor: colors.surfaceLight, // Using surfaceLight as a subtle divider
    },
    searchButton: {
        width: 40,
        height: 40,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.full, // Circle as per Mini App CSS 'rounded-full'
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
});
