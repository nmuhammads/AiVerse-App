import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, FlatList, Modal, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';
import * as Haptics from 'expo-haptics';
import { ChevronDown, LayoutGrid, Grid3X3, Check } from 'lucide-react-native';

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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0, width: 0 });
    const buttonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

    const handlePress = (action: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action();
    };

    const currentDate = new Date().toLocaleString('en-US', { month: 'long' });
    const selectedModelLabel = MODEL_OPTIONS.find(o => o.value === modelFilter)?.label || 'All Models';

    const openDropdown = () => {
        handlePress(() => {
            buttonRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                setDropdownPosition({
                    top: y + height + 4,
                    right: Dimensions.get('window').width - (x + width),
                    width: Math.max(width, 180), // Min width or button width
                });
                setIsDropdownOpen(true);
            });
        });
    };

    const handleModelSelect = (value: string) => {
        handlePress(() => {
            onModelFilterChange(value);
            setIsDropdownOpen(false);
        });
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

                {/* Model Selector Button */}
                <TouchableOpacity
                    ref={buttonRef}
                    style={[styles.modelSelector, isDropdownOpen && styles.modelSelectorActive]}
                    onPress={openDropdown}
                >
                    <Text style={styles.modelText} numberOfLines={1}>{selectedModelLabel}</Text>
                    <ChevronDown size={14} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Modal for Dropdown - ensures it's above everything */}
            <Modal
                visible={isDropdownOpen}
                transparent
                animationType="none"
                onRequestClose={() => setIsDropdownOpen(false)}
            >
                <TouchableWithoutFeedback onPress={() => setIsDropdownOpen(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[
                            styles.dropdownMenu,
                            {
                                top: dropdownPosition.top,
                                right: dropdownPosition.right,
                                width: dropdownPosition.width,
                            }
                        ]}>
                            <FlatList
                                data={MODEL_OPTIONS}
                                keyExtractor={(item) => item.value}
                                scrollEnabled={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.dropdownItem,
                                            modelFilter === item.value && styles.dropdownItemActive
                                        ]}
                                        onPress={() => handleModelSelect(item.value)}
                                    >
                                        <Text style={[
                                            styles.dropdownItemText,
                                            modelFilter === item.value && styles.dropdownItemTextActive
                                        ]}>
                                            {item.label}
                                        </Text>
                                        {modelFilter === item.value && (
                                            <Check size={14} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                            />
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
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
        zIndex: 10,
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
        backgroundColor: '#1c1c1e',
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
    modelSelectorActive: {
        borderColor: colors.primary,
        backgroundColor: colors.surfaceLight,
    },
    modelText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    // Modal Overlay styles
    modalOverlay: {
        flex: 1,
        // No background color, just transparent to catch clicks
    },
    dropdownMenu: {
        position: 'absolute',
        backgroundColor: '#1c1c1e',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    dropdownItemActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    dropdownItemText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    dropdownItemTextActive: {
        color: colors.text,
        fontWeight: '600',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
});
