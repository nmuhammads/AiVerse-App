import React, { useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FeedCard, FeedItem } from './FeedCard';
import { spacing } from '../../theme';

interface FeedGridProps {
    items: FeedItem[];
    viewMode: 'standard' | 'compact';
    onItemPress: (item: FeedItem) => void;
    onLike: (item: FeedItem) => void;
    onRemix: (item: FeedItem) => void;

    // List props
    ListHeaderComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    onEndReached?: () => void;
    onRefresh?: () => void;
    refreshing?: boolean;
}

export function FeedGrid({
    items,
    viewMode,
    onItemPress,
    onLike,
    onRemix,
    ListHeaderComponent,
    ListFooterComponent,
    onEndReached,
    onRefresh,
    refreshing,
}: FeedGridProps) {
    const numColumns = viewMode === 'standard' ? 2 : 3;

    const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
        // Add spacing logic
        const isStandard = viewMode === 'standard';
        const numCols = isStandard ? 2 : 3;

        const style = {
            flex: 1,
            // Add padding to create gap
            paddingLeft: (index % numCols) !== 0 ? spacing.xs / 2 : 0,
            paddingRight: (index % numCols) !== numCols - 1 ? spacing.xs / 2 : 0,
        };

        return (
            <View style={style}>
                <FeedCard
                    item={item}
                    variant={viewMode}
                    onPress={() => onItemPress(item)}
                    onLike={() => onLike(item)}
                    onRemix={() => onRemix(item)}
                />
            </View>
        );
    }, [viewMode, onItemPress, onLike, onRemix]);

    return (
        <View style={styles.container}>
            <FlashList
                data={items}
                numColumns={numColumns}
                renderItem={renderItem}
                // @ts-ignore
                estimatedItemSize={viewMode === 'standard' ? 250 : 120}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListHeaderComponent={ListHeaderComponent ? <>{ListHeaderComponent}</> : null}
                ListFooterComponent={ListFooterComponent ? <>{ListFooterComponent}</> : null}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.listContent,
                    viewMode === 'compact' ? styles.listContentCompact : styles.listContentStandard
                ]}
                keyExtractor={(item: FeedItem) => item.id}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    listContent: {
        paddingBottom: spacing.xl,
    },
    listContentStandard: {
        paddingHorizontal: spacing.sm,
    },
    listContentCompact: {
        paddingHorizontal: spacing.xs,
    },
});
