import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { leadsApi, Lead } from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROJECT_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'residential', label: 'Residential' },
  { key: 'commercial', label: 'Commercial' },
];
const URGENCY_TYPES = [
  { key: 'all', label: 'Any time' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'flexible', label: 'Flexible' },
];
const AUTO_REFRESH_MS = 30000;
const RADIUS_STEPS = [1, 5, 10, 25, 50, 75, 100, 150, 200];

export default function LeadsScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [zip, setZip] = useState('');
  const [zipDraft, setZipDraft] = useState('');
  const [radius, setRadius] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);
  const intervalRef = useRef<any>(null);
  const tickRef = useRef<any>(null);

  // Load saved location prefs
  useEffect(() => {
    (async () => {
      const savedZip = await AsyncStorage.getItem('contractor_zip');
      const savedRadius = await AsyncStorage.getItem('contractor_radius');
      if (savedZip) {
        setZip(savedZip);
        setZipDraft(savedZip);
      }
      if (savedRadius) {
        setRadius(Number(savedRadius));
      }
    })();
  }, []);

  const loadLeads = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = {
        radius,
        project_type: projectFilter,
        urgency: urgencyFilter,
      };
      if (zip) params.zip = zip;
      const res = await leadsApi.feed(params);
      setLeads(res.data.leads || []);
      setLastUpdated(new Date());
      setSecondsUntilRefresh(30);
    } catch (e: any) {
      console.warn('Leads feed error', e?.message);
      if (!silent) {
        Alert.alert('Could not load leads', e?.response?.data?.detail || e?.message || 'Unknown error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [radius, projectFilter, urgencyFilter, zip]);

  // Initial + filter change
  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (tickRef.current) clearInterval(tickRef.current);

    intervalRef.current = setInterval(() => {
      loadLeads(true);
    }, AUTO_REFRESH_MS);
    tickRef.current = setInterval(() => {
      setSecondsUntilRefresh((s) => (s > 0 ? s - 1 : 30));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [loadLeads]);

  const applyZip = async () => {
    const cleaned = zipDraft.replace(/\D/g, '').slice(0, 5);
    if (cleaned.length !== 5) {
      Alert.alert('Invalid zip', 'Please enter a valid 5-digit US zip code');
      return;
    }
    setZip(cleaned);
    setZipDraft(cleaned);
    await AsyncStorage.setItem('contractor_zip', cleaned);
  };

  const applyRadius = async (val: number) => {
    setRadius(val);
    await AsyncStorage.setItem('contractor_radius', String(val));
  };

  const clearZip = async () => {
    setZip('');
    setZipDraft('');
    await AsyncStorage.removeItem('contractor_zip');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  const filteredLeads = leads.filter((ld) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ld.title?.toLowerCase().includes(q) ||
      ld.description?.toLowerCase().includes(q) ||
      ld.city?.toLowerCase().includes(q) ||
      ld.zip_code?.includes(q)
    );
  });

  const renderLead = ({ item }: { item: Lead }) => {
    const urgencyColor =
      item.urgency === 'emergency' ? '#ef4444' :
      item.urgency === 'this_week' ? '#f59e0b' :
      item.urgency === 'this_month' ? '#3b82f6' : '#6b7280';

    return (
      <TouchableOpacity
        style={styles.leadCard}
        onPress={() => router.push(`/lead/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.priceTag}>
            <Text style={styles.priceTagAmount}>${item.lead_price.toFixed(0)}</Text>
            <Text style={styles.priceTagLabel}>to unlock</Text>
          </View>
          <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyColor}22`, borderColor: urgencyColor }]}>
            <Ionicons name="time-outline" size={12} color={urgencyColor} />
            <Text style={[styles.urgencyText, { color: urgencyColor }]}>
              {item.urgency.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <Text style={styles.leadTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.leadDesc} numberOfLines={2}>{item.description}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color="#9ca3af" />
            <Text style={styles.metaText}>
              {item.city ? `${item.city}, ${item.state}` : item.zip_code}
              {item.distance_miles != null ? ` • ${item.distance_miles} mi` : ''}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={14} color="#9ca3af" />
            <Text style={styles.metaText}>~${item.estimated_budget.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.slotsContainer}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.slotDot,
                  { backgroundColor: i < item.unlock_count ? '#6b7280' : '#00ff66' },
                ]}
              />
            ))}
            <Text style={styles.slotsText}>
              {item.slots_remaining} of {item.max_unlocks} slots left
            </Text>
          </View>
          <Text style={styles.timeAgo}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>

        {item.is_unlocked && (
          <View style={styles.unlockedBanner}>
            <Ionicons name="checkmark-circle" size={14} color="#00ff66" />
            <Text style={styles.unlockedText}>You unlocked this lead</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Live Leads</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>
              {lastUpdated ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}` : 'Loading...'}
              {' • '}refresh in {secondsUntilRefresh}s
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/my-leads')}>
          <Ionicons name="folder-open-outline" size={22} color="#00ff66" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/post-lead')}>
          <Ionicons name="add-circle" size={28} color="#00ff66" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name={showFilters ? 'options' : 'options-outline'} size={22} color="#00ff66" />
        </TouchableOpacity>
      </View>

      {/* Location + radius */}
      <View style={styles.locationBar}>
        <Ionicons name="navigate-outline" size={16} color="#00ff66" />
        <TextInput
          style={styles.zipInput}
          placeholder="Your zip code"
          placeholderTextColor="#6b7280"
          value={zipDraft}
          onChangeText={setZipDraft}
          keyboardType="number-pad"
          maxLength={5}
          onSubmitEditing={applyZip}
        />
        {zip ? (
          <TouchableOpacity onPress={clearZip} style={styles.smallBtn}>
            <Ionicons name="close" size={14} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={applyZip} style={[styles.smallBtn, { backgroundColor: '#00ff66' }]}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>Set</Text>
        </TouchableOpacity>
        <View style={styles.radiusPill}>
          <Text style={styles.radiusText}>{radius} mi</Text>
        </View>
      </View>

      {/* Radius slider (chip-style) */}
      <View style={styles.radiusChips}>
        {RADIUS_STEPS.map((step) => (
          <TouchableOpacity
            key={step}
            style={[styles.radiusChip, radius === step && styles.radiusChipActive]}
            onPress={() => applyRadius(step)}
          >
            <Text style={[styles.radiusChipText, radius === step && styles.radiusChipTextActive]}>
              {step}mi
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showFilters && (
        <View style={styles.filtersBox}>
          <Text style={styles.filterLabel}>Project type</Text>
          <View style={styles.chipRow}>
            {PROJECT_TYPES.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.chip, projectFilter === p.key && styles.chipActive]}
                onPress={() => setProjectFilter(p.key)}
              >
                <Text style={[styles.chipText, projectFilter === p.key && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.filterLabel}>Urgency</Text>
          <View style={styles.chipRow}>
            {URGENCY_TYPES.map((u) => (
              <TouchableOpacity
                key={u.key}
                style={[styles.chip, urgencyFilter === u.key && styles.chipActive]}
                onPress={() => setUrgencyFilter(u.key)}
              >
                <Text style={[styles.chipText, urgencyFilter === u.key && styles.chipTextActive]}>
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#00ff66" />
          <Text style={styles.emptyTitle}>Loading live leads...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => item.id}
          renderItem={renderLead}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00ff66" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="flash-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyTitle}>No leads in your area yet</Text>
              <Text style={styles.emptySubtitle}>
                {zip
                  ? `Try increasing your radius beyond ${radius} miles`
                  : 'Enter your zip code to see nearby leads'}
              </Text>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => router.push('/post-lead')}
              >
                <Ionicons name="share-outline" size={16} color="#000" />
                <Text style={styles.shareBtnText}>Share lead-post link</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#00ff66', marginRight: 6,
  },
  liveLabel: { color: '#9ca3af', fontSize: 11 },
  iconBtn: { padding: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: 12,
    marginHorizontal: 16, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 8 },
  locationBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  zipInput: { flex: 1, color: '#fff', fontSize: 15, height: 40 },
  smallBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#1f2937',
    minWidth: 36, alignItems: 'center', justifyContent: 'center',
  },
  radiusPill: {
    backgroundColor: 'rgba(0,255,102,0.15)', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 12,
  },
  radiusText: { color: '#00ff66', fontWeight: '700', fontSize: 12 },
  radiusChips: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 10,
    flexWrap: 'wrap',
  },
  radiusChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: '#1f2937',
  },
  radiusChipActive: { backgroundColor: '#00ff66' },
  radiusChipText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  radiusChipTextActive: { color: '#000' },
  filtersBox: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: '#111827', padding: 12, borderRadius: 12,
  },
  filterLabel: { color: '#9ca3af', fontSize: 12, marginTop: 4, marginBottom: 6, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1f2937' },
  chipActive: { backgroundColor: '#00ff66' },
  chipText: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#000' },
  listContent: { padding: 16, paddingTop: 12 },
  leadCard: {
    backgroundColor: '#1f2937', borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#374151',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  priceTag: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceTagAmount: { color: '#00ff66', fontSize: 22, fontWeight: '800' },
  priceTagLabel: { color: '#9ca3af', fontSize: 11 },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
  },
  urgencyText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  leadTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  leadDesc: { color: '#9ca3af', fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#9ca3af', fontSize: 12 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#374151',
  },
  slotsContainer: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  slotDot: { width: 8, height: 8, borderRadius: 4 },
  slotsText: { color: '#9ca3af', fontSize: 11, marginLeft: 4 },
  timeAgo: { color: '#6b7280', fontSize: 11 },
  unlockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,255,102,0.1)', padding: 8, borderRadius: 8, marginTop: 10,
  },
  unlockedText: { color: '#00ff66', fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#9ca3af', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00ff66', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, marginTop: 20,
  },
  shareBtnText: { color: '#000', fontWeight: '700' },
});
