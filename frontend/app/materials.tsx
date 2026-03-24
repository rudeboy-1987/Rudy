import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { materialsApi, MaterialPrice } from '../src/services/api';

export default function MaterialsScreen() {
  const router = useRouter();
  const [materials, setMaterials] = useState<MaterialPrice[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<MaterialPrice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All', icon: 'grid' },
    { id: 'wire', label: 'Wire', icon: 'git-branch' },
    { id: 'conduit', label: 'Conduit', icon: 'analytics' },
    { id: 'boxes', label: 'Boxes', icon: 'cube' },
    { id: 'devices', label: 'Devices', icon: 'toggle' },
    { id: 'panels', label: 'Panels', icon: 'server' },
    { id: 'lighting', label: 'Lighting', icon: 'bulb' },
    { id: 'specialty', label: 'Specialty', icon: 'star' },
  ];

  const loadMaterials = async () => {
    try {
      const response = await materialsApi.getPrices();
      if (response.data.length === 0) {
        // Seed initial data
        await materialsApi.seedPrices();
        const seededResponse = await materialsApi.getPrices();
        setMaterials(seededResponse.data);
        setFilteredMaterials(seededResponse.data);
      } else {
        setMaterials(response.data);
        setFilteredMaterials(response.data);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    let filtered = materials;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query)
      );
    }

    setFilteredMaterials(filtered);
  }, [materials, selectedCategory, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMaterials();
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.id === category);
    return cat?.icon || 'pricetag';
  };

  const renderMaterial = ({ item }: { item: MaterialPrice }) => (
    <View style={styles.materialCard}>
      <View style={styles.materialIcon}>
        <Ionicons name={getCategoryIcon(item.category) as any} size={24} color="#f59e0b" />
      </View>
      <View style={styles.materialInfo}>
        <Text style={styles.materialName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.materialDescription}>{item.description}</Text>
        )}
        <View style={styles.materialMeta}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <Text style={styles.unitText}>per {item.unit}</Text>
        </View>
      </View>
      <View style={styles.priceContainer}>
        <Text style={styles.priceValue}>${item.price.toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Material Prices</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoBannerText}>
          Prices are updated regularly based on market rates
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search materials..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === item.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(item.id)}
          >
            <Ionicons
              name={item.icon as any}
              size={16}
              color={selectedCategory === item.id ? '#000' : '#9ca3af'}
            />
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === item.id && styles.categoryChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Materials List */}
      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.id}
        renderItem={renderMaterial}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyTitle}>No materials found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Materials database is empty'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  infoBannerText: {
    color: '#3b82f6',
    fontSize: 14,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#f59e0b',
  },
  categoryChipText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#000000',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  materialIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialInfo: {
    flex: 1,
    marginLeft: 12,
  },
  materialName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  materialDescription: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  materialMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    color: '#9ca3af',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  unitText: {
    color: '#6b7280',
    fontSize: 12,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
