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
import { jobsApi, Job } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { format } from 'date-fns';

export default function JobsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const loadJobs = useCallback(async () => {
    try {
      const response = await jobsApi.getAll();
      setJobs(response.data);
      setFilteredJobs(response.data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        Alert.alert(
          'Premium Feature',
          'Job board access requires a premium subscription ($19.99/month)',
          [{ text: 'OK' }]
        );
      }
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    let filtered = jobs;

    if (filter !== 'all') {
      filtered = filtered.filter((j) => j.project_type === filter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title.toLowerCase().includes(query) ||
          j.description.toLowerCase().includes(query) ||
          j.location.toLowerCase().includes(query)
      );
    }

    setFilteredJobs(filtered);
  }, [jobs, filter, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => router.push(`/job/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.posterInfo}>
          <View style={styles.posterIcon}>
            <Ionicons
              name={item.poster_type === 'homeowner' ? 'home' : 'business'}
              size={20}
              color="#3b82f6"
            />
          </View>
          <View>
            <Text style={styles.posterName}>{item.poster_name}</Text>
            <Text style={styles.posterType}>
              {item.poster_type === 'homeowner' ? 'Homeowner' : 'Business'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'open'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(107, 114, 128, 0.1)',
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: item.status === 'open' ? '#10b981' : '#6b7280' },
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.jobTitle}>{item.title}</Text>
      <Text style={styles.jobDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
        {item.budget_range && (
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{item.budget_range}</Text>
          </View>
        )}
        {item.timeline && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{item.timeline}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          Posted {format(new Date(item.created_at), 'MMM d, yyyy')}
        </Text>
        <View style={styles.projectTypeBadge}>
          <Ionicons
            name={item.project_type === 'residential' ? 'home-outline' : 'business-outline'}
            size={14}
            color="#f59e0b"
          />
          <Text style={styles.projectTypeText}>{item.project_type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Job Board</Text>
          <Text style={styles.subtitle}>Find new projects in your area</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create-job')}
        >
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
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
        {['all', 'residential', 'commercial'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterTab, filter === type && styles.filterTabActive]}
            onPress={() => setFilter(type)}
          >
            <Text
              style={[styles.filterText, filter === type && styles.filterTextActive]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Jobs List */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyTitle}>No jobs available</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || filter !== 'all'
                ? 'Try changing your filters'
                : 'Check back later for new projects'}
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
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
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
  jobCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  posterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  posterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  posterName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  posterType: {
    color: '#6b7280',
    fontSize: 12,
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
  jobTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  jobDescription: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
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
  dateText: {
    color: '#6b7280',
    fontSize: 12,
  },
  projectTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  projectTypeText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
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
