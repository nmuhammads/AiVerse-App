import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../theme';
import * as Haptics from 'expo-haptics';
import { ChevronDown, LayoutGrid, Grid3X3 } from 'lucide-react-native';

const MODEL_OPTIONS = [
    { value: 'all', label: 'All Models' },
    { value: 'nanobanana', label: 'NanoBanana' },
    { value: 'nanobanana-pro', label: 'NanoBanana Pro' },
    { value: 'seedream4', label: 'SeeDream 4' },
    { value: 'seedream4-5', label: 'SeeDream 4.5' },
    { value: 'seedance-1.5-pro', label: 'Seedance Pro' },
    { value: 'gptimage1.5', label: 'GPT Image 1.5' },
];

interface FeedFiltersProps {
    viewMode: 'standard' | 'compact';
    modelFilter: string;
    onViewModeChange: (mode: 'standard' | 'compact') => void;
    onModelFilterChange: (model: string) => void;
}

export function FeedFilters({
    viewMode,
    modelFilter,
    onViewModeChange,
    onModelFilterChange,
}: FeedFiltersProps) {
    const handlePress = (action: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action();
    };

    const currentDate = new Date().toLocaleString('en-US', { month: 'long' });
    const selectedModelLabel = MODEL_OPTIONS.find(o => o.value === modelFilter)?.label || 'All Models';

    // Simple cycle for now, or could use ActionSheet/Modal in future refactor
    const handleModelPress = () => {
        const currentIndex = MODEL_OPTIONS.findIndex(o => o.value === modelFilter);
        const nextIndex = (currentIndex + 1) % MODEL_OPTIONS.length;
        handlePress(() => onModelFilterChange(MODEL_OPTIONS[nextIndex].value));
    };

    return (
        <View style={styles.container}>
            <View style={styles.leftContainer}>
                <Text style={styles.dateTitle}>{currentDate}</Text>
            </View>

            <View style={styles.rightContainer}>
                {/* View Toggle */}
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={[styles.toggleButton, viewMode === 'standard' && styles.toggleButtonActive]}
                        onPress={() => handlePress(() => onViewModeChange('standard'))}
                    >
                        <LayoutGrid
                            size={14}
                            color={viewMode === 'standard' ? colors.text : colors.textSecondary}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, viewMode === 'compact' && styles.toggleButtonActive]}
                        onPress={() => handlePress(() => onViewModeChange('compact'))}
                    >
                        <Grid3X3
                            size={14}
                            color={viewMode === 'compact' ? colors.text : colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                {/* Model Selector (Mock Dropdown) */}
                <TouchableOpacity
                    style={styles.modelSelector}
                    onPress={handleModelPress}
                >
                    <Text style={styles.modelText} numberOfLines={1}>{selectedModelLabel}</Text>
                    <ChevronDown size={14} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.sm,
    },
    leftContainer: {
        flex: 1,
    },
    dateTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#1c1c1e', // Hex from Mini App
        borderRadius: borderRadius.md,
        padding: 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        gap: 2,
    },
    toggleButton: {
        padding: 4,
        borderRadius: 4,
    },
    toggleButtonActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
            },
        }),
    },
    modelSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        paddingVertical: 6,
        paddingHorizontal: 12,
        gap: 8,
        maxWidth: 140,
    },
    modelText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textSecondary, // Zinc-300 roughly
    },
});
