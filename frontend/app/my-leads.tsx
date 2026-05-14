import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { leadsApi, Lead } from '../src/services/api';
import { formatDistanceToNow } from 'date-fns';

export default function MyLeadsScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await leadsApi.myUnlocked();
      setLeads(res.data.leads || []);
    } catch (e) {
      console.warn('My leads error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderItem = ({ item }: { item: Lead }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/lead/${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <View style={styles.unlockedPill}>
          <Ionicons name="lock-open" size={12} color="#00ff66" />
          <Text style={styles.unlockedPillText}>Unlocked</Text>
        </View>
      </View>
      <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={13} color="#9ca3af" />
        <Text style={styles.metaText}>
          {item.city ? `${item.city}, ${item.state}` : item.zip_code}
        </Text>
      </View>
      <View style={styles.contactRow}>
        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => Linking.openURL(`tel:${item.poster_phone}`)}
        >
          <Ionicons name="call" size={14} color="#000" />
          <Text style={styles.contactBtnText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.contactBtn, { backgroundColor: '#3b82f6' }]}
          onPress={() => Linking.openURL(`sms:${item.poster_phone}`)}
        >
          <Ionicons name="chatbubble" size={14} color="#fff" />
          <Text style={[styles.contactBtnText, { color: '#fff' }]}>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.contactBtn, { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151' }]}
          onPress={() => Linking.openURL(`mailto:${item.poster_email}`)}
        >
          <Ionicons name="mail" size={14} color="#fff" />
          <Text style={[styles.contactBtnText, { color: '#fff' }]}>Email</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.timeAgo}>
        Unlocked • posted {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Unlocked Leads</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00ff66" />
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00ff66" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyTitle}>No unlocked leads yet</Text>
              <Text style={styles.emptyHint}>
                When you unlock a lead from the live feed, full contact details will appear here.
              </Text>
              <TouchableOpacity style={styles.cta} onPress={() => router.back()}>
                <Text style={styles.ctaText}>Browse live leads</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#1f2937', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#374151',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  unlockedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,255,102,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  unlockedPillText: { color: '#00ff66', fontSize: 11, fontWeight: '700' },
  desc: { color: '#9ca3af', fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  metaText: { color: '#9ca3af', fontSize: 12 },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#00ff66', paddingVertical: 10, borderRadius: 10,
  },
  contactBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  timeAgo: { color: '#6b7280', fontSize: 11, marginTop: 10, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyHint: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 8 },
  cta: {
    backgroundColor: '#00ff66', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 20,
  },
  ctaText: { color: '#000', fontWeight: '800' },
});
