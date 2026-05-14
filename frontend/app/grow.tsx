import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { leadsApi } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

// Public-facing base URL where the post-lead web page lives.
// In production this is the deployed Expo web URL.
const PUBLIC_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_PUBLIC_URL ||
  'https://estimate-pro-33.preview.emergentagent.com';

type Stats = {
  referral_code: string | null;
  total_leads: number;
  leads_last_30d: number;
  estimated_value: number;
};

export default function GrowScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await leadsApi.sourceStats();
      setStats(res.data);
    } catch (e) {
      console.warn('stats error', e);
      // Fall back to placeholder stats so the screen still renders
      setStats({ referral_code: user?.referral_code || null, total_leads: 0, leads_last_30d: 0, estimated_value: 0 });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const ref = stats?.referral_code || '';
  const link = ref ? `${PUBLIC_BASE_URL}/post-lead?ref=${ref}` : `${PUBLIC_BASE_URL}/post-lead`;
  const company = user?.company_name || 'a trusted local electrician';

  const shareMessage =
    `⚡ Need an electrician? Get free quotes from ${company} & up to 5 verified pros in your area.\n\n` +
    `Post your job (free, 60 seconds): ${link}`;

  const onShare = async (platformHint?: 'sms' | 'whatsapp' | 'facebook' | 'twitter' | 'email' | 'system') => {
    try {
      if (platformHint === 'sms') {
        const url = `sms:?body=${encodeURIComponent(shareMessage)}`;
        await openExternal(url);
        return;
      }
      if (platformHint === 'whatsapp') {
        const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
        await openExternal(url, 'WhatsApp not installed');
        return;
      }
      if (platformHint === 'facebook') {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(shareMessage)}`;
        await openExternal(url);
        return;
      }
      if (platformHint === 'twitter') {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;
        await openExternal(url);
        return;
      }
      if (platformHint === 'email') {
        const subject = encodeURIComponent('Need an electrician? Free quotes in minutes');
        const body = encodeURIComponent(shareMessage);
        await openExternal(`mailto:?subject=${subject}&body=${body}`);
        return;
      }
      // system share sheet
      await Share.share({
        message: shareMessage,
        url: link,
        title: 'Get an electrician — free quotes',
      });
    } catch (e: any) {
      Alert.alert('Could not share', e?.message || 'Try a different option');
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(link);
    Alert.alert('Copied', 'Your share link is on the clipboard.');
  };

  const copyCode = async () => {
    if (!ref) return;
    await Clipboard.setStringAsync(ref);
    Alert.alert('Copied', `Code ${ref} copied to clipboard.`);
  };

  if (loading || !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00ff66" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grow your business</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Share your link anywhere — Facebook, Instagram, Nextdoor, jobsite flyers, business cards.
          When a homeowner posts a job through your link, you get notified instantly.
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.total_leads}</Text>
            <Text style={styles.statLabel}>Leads from your link</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.leads_last_30d}</Text>
            <Text style={styles.statLabel}>Last 30 days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>${stats.estimated_value.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Est. revenue</Text>
          </View>
        </View>

        {/* Referral code */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Your referral code</Text>
          <TouchableOpacity style={styles.codeRow} onPress={copyCode} activeOpacity={0.7}>
            <Text style={styles.codeText}>{ref || '—'}</Text>
            <Ionicons name="copy-outline" size={20} color="#00ff66" />
          </TouchableOpacity>
        </View>

        {/* Shareable link */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Your share link</Text>
          <TouchableOpacity style={styles.linkRow} onPress={copyLink} activeOpacity={0.7}>
            <Text style={styles.linkText} numberOfLines={1}>{link}</Text>
            <Ionicons name="copy-outline" size={20} color="#00ff66" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.bigShareBtn} onPress={() => onShare('system')}>
            <Ionicons name="share-social" size={22} color="#000" />
            <Text style={styles.bigShareText}>Share via…</Text>
          </TouchableOpacity>
        </View>

        {/* One-tap channels */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Post directly to</Text>
          <View style={styles.channelGrid}>
            <ChannelBtn icon="logo-facebook" label="Facebook" color="#1877F2" onPress={() => onShare('facebook')} />
            <ChannelBtn icon="logo-twitter" label="X / Twitter" color="#0a0a0a" border onPress={() => onShare('twitter')} />
            <ChannelBtn icon="logo-whatsapp" label="WhatsApp" color="#25D366" onPress={() => onShare('whatsapp')} />
            <ChannelBtn icon="chatbubbles" label="SMS" color="#22c55e" onPress={() => onShare('sms')} />
            <ChannelBtn icon="mail" label="Email" color="#3b82f6" onPress={() => onShare('email')} />
            <ChannelBtn icon="logo-instagram" label="Instagram" color="#E1306C" onPress={() => onShare('system')} />
          </View>
          <Text style={styles.helperHint}>
            Tip: Facebook, Reddit, and Nextdoor are gold-mines for local electrical leads.
          </Text>
        </View>

        {/* QR Code poster */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Printable QR poster</Text>
          <Text style={styles.helperHint}>
            Print or screenshot this and stick it on your truck, jobsite signs, or business cards.
          </Text>
          <View style={styles.qrFrame}>
            <View style={styles.qrPoster}>
              <Text style={styles.posterTitle}>NEED AN</Text>
              <Text style={styles.posterTitleAccent}>ELECTRICIAN?</Text>
              <Text style={styles.posterSubtitle}>Scan to get free quotes in minutes</Text>

              <View style={styles.qrBox}>
                {ref ? (
                  <QRCode
                    value={link}
                    size={180}
                    backgroundColor="#ffffff"
                    color="#0a0a0a"
                    getRef={(c) => (qrRef.current = c)}
                  />
                ) : null}
              </View>

              <Text style={styles.posterCompany}>{company}</Text>
              <Text style={styles.posterCode}>Code: {ref}</Text>
            </View>
          </View>
        </View>

        {/* Suggested copy */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Ready-to-paste copy</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={shareMessage}
            editable={false}
            selectTextOnFocus
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={async () => {
              await Clipboard.setStringAsync(shareMessage);
              Alert.alert('Copied', 'Paste it on Facebook, Instagram, Nextdoor, etc.');
            }}
          >
            <Ionicons name="copy-outline" size={16} color="#00ff66" />
            <Text style={styles.secondaryBtnText}>Copy text</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Tip: Each verified lead is exclusive to 5 pros max. The faster you share, the more leads
          land in your feed.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

async function openExternal(url: string, fallbackErr?: string) {
  const { Linking } = require('react-native');
  const can = await Linking.canOpenURL(url);
  if (!can) {
    if (fallbackErr) Alert.alert('Cannot open', fallbackErr);
    return;
  }
  await Linking.openURL(url);
}

function ChannelBtn({
  icon, label, color, onPress, border,
}: { icon: any; label: string; color: string; onPress: () => void; border?: boolean }) {
  return (
    <TouchableOpacity
      style={[
        styles.channelBtn,
        { backgroundColor: border ? '#0a0a0a' : color },
        border ? { borderWidth: 1, borderColor: '#9ca3af' } : null,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={styles.channelLabel}>{label}</Text>
    </TouchableOpacity>
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
  scroll: { padding: 16, paddingBottom: 60 },
  subtitle: { color: '#9ca3af', fontSize: 13, lineHeight: 18, marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: '#1f2937', borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#374151',
  },
  statNum: { color: '#00ff66', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#9ca3af', fontSize: 11, marginTop: 4, textAlign: 'center' },

  card: {
    backgroundColor: '#1f2937', borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#374151',
  },
  sectionLabel: {
    color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', fontWeight: '700',
    marginBottom: 8, letterSpacing: 0.5,
  },
  codeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#00ff66',
  },
  codeText: { color: '#00ff66', fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#374151',
  },
  linkText: { flex: 1, color: '#e5e7eb', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  bigShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ff66', paddingVertical: 14, borderRadius: 12, marginTop: 12,
  },
  bigShareText: { color: '#000', fontWeight: '800', fontSize: 16 },

  channelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  channelBtn: {
    width: '31%', aspectRatio: 1.4, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  channelLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  helperHint: { color: '#6b7280', fontSize: 12, marginTop: 8 },

  qrFrame: { alignItems: 'center', marginTop: 4 },
  qrPoster: {
    width: '100%', backgroundColor: '#ffffff', borderRadius: 14,
    padding: 22, alignItems: 'center',
  },
  posterTitle: { color: '#0a0a0a', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  posterTitleAccent: {
    color: '#00b85a', fontSize: 36, fontWeight: '900', marginBottom: 6, letterSpacing: 1,
  },
  posterSubtitle: { color: '#4b5563', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  qrBox: { padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 2, borderColor: '#0a0a0a' },
  posterCompany: { color: '#0a0a0a', fontSize: 16, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  posterCode: { color: '#4b5563', fontSize: 13, marginTop: 2 },

  textArea: {
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 12,
    color: '#e5e7eb', fontSize: 13, minHeight: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#374151',
  },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, marginTop: 8,
    borderWidth: 1, borderColor: '#00ff66',
  },
  secondaryBtnText: { color: '#00ff66', fontWeight: '700' },

  disclaimer: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
