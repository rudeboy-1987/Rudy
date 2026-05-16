import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../src/services/api';

type Status = {
  connected: boolean;
  page_id?: string;
  page_name?: string;
  fan_count?: number;
  auto_post_new_leads?: boolean;
  connected_at?: string;
};

export default function FacebookConnectScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [pageId, setPageId] = useState('');
  const [token, setToken] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await api.get('/social/facebook/status');
      setStatus(res.data);
      setAutoPost(!!res.data.auto_post_new_leads);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    if (!pageId.trim() || !token.trim()) {
      Alert.alert('Missing', 'Please paste both Page ID and Access Token');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/social/facebook/connect', {
        page_id: pageId.trim(),
        page_access_token: token.trim(),
        auto_post_new_leads: autoPost,
      });
      Alert.alert('Connected ✅', `Linked to "${res.data.page_name}" (${res.data.fan_count || 0} fans)`);
      setPageId(''); setToken('');
      load();
    } catch (e: any) {
      Alert.alert('Could not connect', e?.response?.data?.detail || 'Check Page ID and Token');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    Alert.alert('Disconnect Facebook?', 'You can reconnect anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await api.post('/social/facebook/disconnect');
          setStatus({ connected: false });
        },
      },
    ]);
  };

  const toggleAutoPost = async (val: boolean) => {
    setAutoPost(val);
    if (status.connected) {
      try {
        await api.post('/social/facebook/connect', {
          page_id: status.page_id,
          page_access_token: 'noop',  // server-side will reuse existing token (but we send anyway)
          auto_post_new_leads: val,
        });
      } catch {
        // ignore — toggle is best-effort and user can re-paste token if needed
      }
    }
  };

  const postNow = async () => {
    setPosting(true);
    try {
      const me = await api.get('/auth/me');
      const company = me.data.company_name;
      const refCode = me.data.referral_code;
      const link = `${(process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '')}/post-lead?ref=${refCode}`;
      const message = `⚡ Need an electrician? Get free quotes from ${company} & up to 5 verified pros in your area.\n\nPost your job (free, 60 seconds): ${link}`;
      const res = await api.post('/social/facebook/post', { message, link });
      if (res.data?.post_id) {
        Alert.alert('Posted to Facebook ✅', 'Your share link is now live on your Page.', [
          { text: 'View post', onPress: () => Linking.openURL(res.data.url) },
          { text: 'Done' },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Post failed', e?.response?.data?.detail || 'Try again');
    } finally {
      setPosting(false);
    }
  };

  const openHelpToken = () => {
    Linking.openURL('https://developers.facebook.com/tools/explorer/');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#00ff66" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facebook Auto-Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.fbIcon}>
              <Ionicons name="logo-facebook" size={32} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>
              {status.connected ? `Linked to ${status.page_name}` : 'Connect your Facebook Page'}
            </Text>
            <Text style={styles.heroSub}>
              {status.connected
                ? `${status.fan_count || 0} fans • Auto-posting ${autoPost ? 'enabled' : 'paused'}`
                : 'Auto-post your share link & new leads to your Business Page.'}
            </Text>
          </View>

          {status.connected ? (
            <>
              <View style={styles.card}>
                <View style={styles.rowSpread}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Auto-post new leads</Text>
                    <Text style={styles.cardSub}>When a new lead lands in your area, it's auto-posted to your Page.</Text>
                  </View>
                  <Switch value={autoPost} onValueChange={toggleAutoPost} trackColor={{ true: '#00ff66', false: '#374151' }} thumbColor="#fff" />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, posting && { opacity: 0.6 }]}
                onPress={postNow}
                disabled={posting}
              >
                {posting ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name="megaphone" size={18} color="#000" />
                    <Text style={styles.primaryBtnText}>Post my share link now</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.dangerBtn} onPress={disconnect}>
                <Ionicons name="unlink" size={16} color="#ef4444" />
                <Text style={styles.dangerText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Page ID</Text>
                <Text style={styles.hint}>Found in Page Settings → About (15-16 digit number)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 102345678901234"
                  placeholderTextColor="#6b7280"
                  value={pageId}
                  onChangeText={setPageId}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Page Access Token</Text>
                <Text style={styles.hint}>Generate at Graph API Explorer with pages_manage_posts permission</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  placeholder="EAAxxxxxxxxx..."
                  placeholderTextColor="#6b7280"
                  value={token}
                  onChangeText={setToken}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity style={styles.helpLink} onPress={openHelpToken}>
                  <Ionicons name="open-outline" size={14} color="#3b82f6" />
                  <Text style={styles.helpLinkText}>Open Graph API Explorer →</Text>
                </TouchableOpacity>

                <View style={styles.rowSpread}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Auto-post new leads</Text>
                    <Text style={styles.cardSub}>You can change this later.</Text>
                  </View>
                  <Switch value={autoPost} onValueChange={setAutoPost} trackColor={{ true: '#00ff66', false: '#374151' }} thumbColor="#fff" />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={connect}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name="link" size={18} color="#000" />
                    <Text style={styles.primaryBtnText}>Connect Page</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* How-to */}
          <View style={styles.howTo}>
            <Text style={styles.howToTitle}>How to get a Page Access Token</Text>
            <Text style={styles.howToStep}>1. Go to <Text style={styles.link} onPress={() => Linking.openURL('https://developers.facebook.com/apps')}>developers.facebook.com/apps</Text> and create a free app (Business type)</Text>
            <Text style={styles.howToStep}>2. Add your Facebook Page to the app</Text>
            <Text style={styles.howToStep}>3. Open Graph API Explorer → choose your app → "Get User Access Token"</Text>
            <Text style={styles.howToStep}>4. Add permissions: <Text style={styles.code}>pages_manage_posts</Text>, <Text style={styles.code}>pages_read_engagement</Text></Text>
            <Text style={styles.howToStep}>5. From the dropdown, switch to "Page Access Token" for your Page</Text>
            <Text style={styles.howToStep}>6. Copy that long token and paste it above</Text>
            <Text style={styles.howToStep}>⚠️ Personal profiles can't be auto-posted to (Meta blocked this in 2018). You need a Page.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 60 },

  hero: { alignItems: 'center', marginBottom: 16 },
  fbIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#1877F2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: '#9ca3af', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },

  card: {
    backgroundColor: '#1f2937', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#374151', marginBottom: 12,
  },
  rowSpread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardSub: { color: '#9ca3af', fontSize: 12, marginTop: 2 },

  label: { color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 10, marginBottom: 2 },
  hint: { color: '#6b7280', fontSize: 11, marginBottom: 6 },
  input: {
    backgroundColor: '#0a0a0a', color: '#fff', paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 10, fontSize: 14, borderWidth: 1, borderColor: '#374151',
  },
  helpLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 14 },
  helpLinkText: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ff66', paddingVertical: 14, borderRadius: 12, marginTop: 4,
  },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#ef4444',
  },
  dangerText: { color: '#ef4444', fontWeight: '700' },

  howTo: {
    marginTop: 20, backgroundColor: '#111827', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1f2937',
  },
  howToTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  howToStep: { color: '#9ca3af', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  link: { color: '#3b82f6', textDecorationLine: 'underline' },
  code: {
    color: '#00ff66',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
  },
});
