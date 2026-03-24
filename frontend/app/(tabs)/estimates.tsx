import React, { useState, useEffect, useCallback } from 'react';
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
import { estimatesApi, Estimate } from '../../src/services/api';
import { format } from 'date-fns';

export default function EstimatesScreen() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [filteredEstimates, setFilteredEstimates] = useState<Estimate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const loadEstimates = useCallback(async () => {
    try {
      const response = await estimatesApi.getAll();
      setEstimates(response.data);
      setFilteredEstimates(response.data);
    } catch (error: any) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  useEffect(() => {
    let filtered = estimates;
    
    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter((e) => e.status === filter);
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.project_name.toLowerCase().includes(query) ||
          e.client_name.toLowerCase().includes(query)
      );
    }
    
    setFilteredEstimates(filtered);
  }, [estimates, filter, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEstimates();
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Estimate', 'Are you sure you want to delete this estimate?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await estimatesApi.delete(id);
            loadEstimates();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete estimate');
          }
        },
      },
    ]);
  };

  const renderEstimate = ({ item }: { item: Estimate }) => (
    <TouchableOpacity
      style={styles.estimateCard}
      onPress={() => router.push(`/estimate/${item.id}`)}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.typeIndicator}>
          <Ionicons
            name={item.project_type === 'residential' ? 'home' : 'business'}
            size={20}
            color="#f59e0b"
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.projectName}>{item.project_name}</Text>
          <Text style={styles.clientName}>{item.client_name}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'sent'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : item.status === 'accepted'
                  ? 'rgba(59, 130, 246, 0.1)'
                  : 'rgba(245, 158, 11, 0.1)',
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  item.status === 'sent'
                    ? '#10b981'
                    : item.status === 'accepted'
                    ? '#3b82f6'
                    : '#f59e0b',
              },
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        {item.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${item.grand_total?.toLocaleString()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Estimates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create-estimate')}
        >
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search estimates..."
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

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'draft', 'sent', 'accepted'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterTab, filter === status && styles.filterTabActive]}
            onPress={() => setFilter(status)}
          >
            <Text
              style={[styles.filterText, filter === status && styles.filterTextActive]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Estimates List */}
      <FlatList
        data={filteredEstimates}
        keyExtractor={(item) => item.id}
        renderItem={renderEstimate}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyTitle}>No estimates found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || filter !== 'all'
                ? 'Try changing your filters'
                : 'Create your first estimate to get started'}
            </Text>
            {!searchQuery && filter === 'all' && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/create-estimate')}
              >
                <Text style={styles.createButtonText}>Create Estimate</Text>
              </TouchableOpacity>
            )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
  },
  filterTabActive: {
    backgroundColor: '#f59e0b',
  },
  filterText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#000000',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  estimateCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIndicator: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  projectName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  clientName: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  cardDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    color: '#9ca3af',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  totalLabel: {
    color: '#6b7280',
    fontSize: 12,
  },
  totalValue: {
    color: '#10b981',
    fontSize: 20,
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
  createButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  createButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
