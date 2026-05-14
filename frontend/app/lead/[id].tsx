import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { leadsApi, Lead } from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';

export default function LeadDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await leadsApi.getOne(id);
      setLead(res.data);
    } catch (e: any) {
      Alert.alert('Lead not found', e?.response?.data?.detail || 'Could not load lead');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const onUnlock = async () => {
    if (!lead) return;
    setUnlocking(true);
    try {
      const res = await leadsApi.createUnlockOrder(lead.id);
      const url = res.data.approval_url;
      const paymentId = res.data.payment_id;
      if (!url) throw new Error('No approval URL');

      // Open PayPal in in-app browser
      const result = await WebBrowser.openAuthSessionAsync(url, undefined);
      if (result.type === 'success' && result.url) {
        // PayPal redirects with PayerID + paymentId in query string
        const parsed = new URL(result.url);
        const payerId = parsed.searchParams.get('PayerID');
        if (payerId) {
          const cap = await leadsApi.captureUnlock(lead.id, paymentId, payerId);
          setLead(cap.data.lead);
          Alert.alert('Unlocked!', 'Contact info revealed below.');
        } else {
          Alert.alert('Cancelled', 'Payment was not completed.');
        }
      } else if (result.type === 'dismiss' || result.type === 'cancel') {
        // user may have completed payment and returned manually; refresh lead
        await load();
      }
    } catch (e: any) {
      Alert.alert('Unlock failed', e?.response?.data?.detail || e?.message || 'Try again');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading || !lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00ff66" />
        </View>
      </SafeAreaView>
    );
  }

  const urgencyColor =
    lead.urgency === 'emergency' ? '#ef4444' :
    lead.urgency === 'this_week' ? '#f59e0b' :
    lead.urgency === 'this_month' ? '#3b82f6' : '#6b7280';

  const slotsRem = lead.slots_remaining;
  const isLocked = slotsRem <= 0 && !lead.is_unlocked;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topCard}>
          <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyColor}22`, borderColor: urgencyColor }]}>
            <Ionicons name="time-outline" size={12} color={urgencyColor} />
            <Text style={[styles.urgencyText, { color: urgencyColor }]}>
              {lead.urgency.replace('_', ' ')}
            </Text>
          </View>
          <Text style={styles.title}>{lead.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color="#9ca3af" />
            <Text style={styles.metaText}>
              {lead.city ? `${lead.city}, ${lead.state}` : `Zip ${lead.zip_code}`}
              {lead.distance_miles != null ? ` • ${lead.distance_miles} mi away` : ''}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="cash-outline" size={14} color="#9ca3af" />
            <Text style={styles.metaText}>Budget: ~${lead.estimated_budget.toLocaleString()}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
            <Text style={styles.metaText}>
              Posted {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Description</Text>
        <View style={styles.card}>
          <Text style={styles.descText}>{lead.description}</Text>
        </View>

        {lead.images?.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {lead.images.map((b64, i) => (
                <Image
                  key={i}
                  source={{ uri: `data:image/jpeg;base64,${b64}` }}
                  style={styles.photo}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Slots */}
        <View style={styles.card}>
          <View style={styles.slotHeader}>
            <Text style={styles.slotsTitle}>Exclusivity</Text>
            <Text style={styles.slotsTitleNum}>{slotsRem} of {lead.max_unlocks} slots left</Text>
          </View>
          <View style={styles.slotsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.slotPill,
                  { backgroundColor: i < lead.unlock_count ? '#6b7280' : '#00ff66' },
                ]}
              />
            ))}
          </View>
          <Text style={styles.slotHint}>
            Only 5 contractors can ever contact this client. Lock it in before others do.
          </Text>
        </View>

        {/* Contact / unlock */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Customer contact</Text>
          {lead.is_unlocked ? (
            <>
              <View style={styles.contactRow}>
                <Ionicons name="person-outline" size={18} color="#00ff66" />
                <Text style={styles.contactText}>{lead.poster_name}</Text>
              </View>
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL(`tel:${lead.poster_phone}`)}
              >
                <Ionicons name="call-outline" size={18} color="#00ff66" />
                <Text style={[styles.contactText, styles.link]}>{lead.poster_phone}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL(`mailto:${lead.poster_email}`)}
              >
                <Ionicons name="mail-outline" size={18} color="#00ff66" />
                <Text style={[styles.contactText, styles.link]}>{lead.poster_email}</Text>
              </TouchableOpacity>
              {lead.address ? (
                <View style={styles.contactRow}>
                  <Ionicons name="home-outline" size={18} color="#00ff66" />
                  <Text style={styles.contactText}>{lead.address}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.maskedRow}>
                <Ionicons name="person-outline" size={18} color="#6b7280" />
                <Text style={styles.maskedText}>{lead.poster_name}</Text>
              </View>
              <View style={styles.maskedRow}>
                <Ionicons name="call-outline" size={18} color="#6b7280" />
                <Text style={styles.maskedText}>{lead.poster_phone}</Text>
              </View>
              <View style={styles.maskedRow}>
                <Ionicons name="mail-outline" size={18} color="#6b7280" />
                <Text style={styles.maskedText}>{lead.poster_email}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      {!lead.is_unlocked && (
        <View style={styles.bottomBar}>
          {isLocked ? (
            <View style={[styles.unlockBtn, { backgroundColor: '#374151' }]}>
              <Ionicons name="lock-closed" size={18} color="#9ca3af" />
              <Text style={[styles.unlockBtnText, { color: '#9ca3af' }]}>Lead is full</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.unlockBtn, unlocking && { opacity: 0.7 }]}
              onPress={onUnlock}
              disabled={unlocking}
            >
              {unlocking ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="lock-open" size={18} color="#000" />
                  <Text style={styles.unlockBtnText}>
                    Unlock for ${lead.lead_price.toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <Text style={styles.bottomHint}>Paid securely via PayPal. One-time fee.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 120 },
  topCard: {
    backgroundColor: '#1f2937', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#374151', marginBottom: 14,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
    marginBottom: 10,
  },
  urgencyText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { color: '#9ca3af', fontSize: 13 },
  sectionLabel: { color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', fontWeight: '700', marginBottom: 6, marginTop: 6 },
  card: {
    backgroundColor: '#1f2937', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#374151', marginBottom: 14,
  },
  descText: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  photo: { width: 130, height: 130, borderRadius: 10, marginRight: 8, backgroundColor: '#1f2937' },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  slotsTitle: { color: '#fff', fontWeight: '700' },
  slotsTitleNum: { color: '#00ff66', fontWeight: '700' },
  slotsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  slotPill: { flex: 1, height: 8, borderRadius: 4 },
  slotHint: { color: '#9ca3af', fontSize: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  contactText: { color: '#fff', fontSize: 15 },
  link: { color: '#00ff66' },
  maskedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  maskedText: { color: '#6b7280', fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0a0a0a', borderTopColor: '#1f2937', borderTopWidth: 1,
    padding: 14, paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ff66', paddingVertical: 14, borderRadius: 12,
  },
  unlockBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  bottomHint: { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 6 },
});
