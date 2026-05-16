import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

// Brand constants (easy to white-label per contractor)
const BRAND = {
  name: 'Done Right Electric Ltd.',
  short: 'Done Right Electric',
  tagline: "San Antonio's Trusted Electrical Contractor",
  phone: '(210) 393-4239',
  phoneTel: 'tel:+12103934239',
  email: 'contact@donerightelectricltd.com',
  years: '18+',
  city: 'San Antonio, TX',
  refCode: 'ZQA5QA',
};

const SERVICES = [
  { icon: 'flash' as const, title: 'Panel Upgrades', desc: '100A → 200A → 400A service upgrades' },
  { icon: 'car-sport' as const, title: 'EV Charger Install', desc: 'Tesla, ChargePoint, all Level-2 chargers' },
  { icon: 'bulb' as const, title: 'Recessed Lighting', desc: 'LED retrofits, dimmers, smart switches' },
  { icon: 'shield-checkmark' as const, title: 'GFCI & AFCI', desc: 'Kitchen, bath, garage, outdoor outlets' },
  { icon: 'home' as const, title: 'Whole-Home Rewiring', desc: 'Knob & tube removal, code compliance' },
  { icon: 'business' as const, title: 'Commercial', desc: 'Restaurants, offices, retail spaces' },
];

const WHY = [
  { icon: 'time' as const, text: 'Free instant quotes in 60 seconds' },
  { icon: 'shield' as const, text: 'Licensed & fully insured' },
  { icon: 'ribbon' as const, text: `${BRAND.years} years of hands-on experience` },
  { icon: 'flame' as const, text: 'Same-day service for emergencies' },
  { icon: 'cash' as const, text: 'Up-front pricing, no surprises' },
  { icon: 'location' as const, text: 'Locally owned & operated' },
];

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // If a logged-in contractor lands on /, send them to dashboard.
  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/dashboard');
    }
  }, [user, loading, router]);

  // Render the landing page eagerly. Logged-in contractors will be redirected via the
  // useEffect above — they'll briefly see the marketing page which is fine UX.
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/logo.png')} style={styles.logoSmall} />
            <Text style={styles.brandName} numberOfLines={1}>{BRAND.short}</Text>
          </View>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>Contractor login</Text>
          </TouchableOpacity>
        </View>

        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroAccentDot} />
          <Text style={styles.heroEyebrow}>⚡ {BRAND.city.toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{BRAND.name}</Text>
          <Text style={styles.heroTagline}>{BRAND.tagline}</Text>
          <Text style={styles.heroSub}>
            {BRAND.years} years of experience • Licensed • Fully insured • Same-day service
          </Text>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.ctaPrimary}
              onPress={() => router.push(`/post-lead?ref=${BRAND.refCode}`)}
            >
              <Ionicons name="flash" size={20} color="#000" />
              <Text style={styles.ctaPrimaryText}>Get a free quote</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => Linking.openURL(BRAND.phoneTel)}
            >
              <Ionicons name="call" size={18} color="#00ff66" />
              <Text style={styles.ctaSecondaryText}>{BRAND.phone}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Ionicons name="checkmark-circle" size={14} color="#00ff66" />
              <Text style={styles.trustText}>60-sec quote</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="checkmark-circle" size={14} color="#00ff66" />
              <Text style={styles.trustText}>No obligation</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="checkmark-circle" size={14} color="#00ff66" />
              <Text style={styles.trustText}>100% free</Text>
            </View>
          </View>
        </View>

        {/* SERVICES */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What we do</Text>
          <Text style={styles.sectionTitle}>Electrical services done right</Text>
          <View style={styles.servicesGrid}>
            {SERVICES.map((s) => (
              <View key={s.title} style={styles.serviceCard}>
                <View style={styles.serviceIcon}>
                  <Ionicons name={s.icon} size={24} color="#00ff66" />
                </View>
                <Text style={styles.serviceTitle}>{s.title}</Text>
                <Text style={styles.serviceDesc}>{s.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* WHY */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Why us</Text>
          <Text style={styles.sectionTitle}>San Antonio homeowners trust us because…</Text>
          <View style={styles.whyList}>
            {WHY.map((w) => (
              <View key={w.text} style={styles.whyItem}>
                <View style={styles.whyIcon}>
                  <Ionicons name={w.icon} size={18} color="#00ff66" />
                </View>
                <Text style={styles.whyText}>{w.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* HOW IT WORKS */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How it works</Text>
          <Text style={styles.sectionTitle}>Get a quote in 3 easy steps</Text>
          <View style={styles.stepsList}>
            <Step n="1" title="Describe your job" desc="Outlets, lighting, panel upgrade, EV charger — anything electrical. Snap a photo if you have one." />
            <Step n="2" title="Verify your contact" desc="Quick email + phone verification so we know you're real (takes 30 seconds)." />
            <Step n="3" title="Get matched" desc={`${BRAND.short} + up to 4 other licensed pros see your job and contact you within minutes.`} />
          </View>
        </View>

        {/* SERVICE AREA */}
        <View style={styles.areaCard}>
          <Ionicons name="location" size={22} color="#00ff66" />
          <Text style={styles.areaTitle}>Service area</Text>
          <Text style={styles.areaText}>
            All of San Antonio + 50-mile radius: Stone Oak • Alamo Heights • Helotes • Boerne • New Braunfels • Cibolo • Schertz • Universal City • Live Oak • Converse • Floresville
          </Text>
        </View>

        {/* BIG CTA */}
        <View style={styles.finalCta}>
          <Text style={styles.finalTitle}>Ready to get started?</Text>
          <Text style={styles.finalSub}>Free quote in 60 seconds — no obligation</Text>
          <TouchableOpacity
            style={styles.finalBtn}
            onPress={() => router.push(`/post-lead?ref=${BRAND.refCode}`)}
          >
            <Text style={styles.finalBtnText}>Get my free quote ⚡</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.finalCallBtn}
            onPress={() => Linking.openURL(BRAND.phoneTel)}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.finalCallText}>Or call {BRAND.phone}</Text>
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Image source={require('../assets/logo.png')} style={styles.footerLogo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.footerBrand}>{BRAND.name}</Text>
              <Text style={styles.footerLine}>📞 {BRAND.phone}</Text>
              <Text style={styles.footerLine}>📍 {BRAND.city}</Text>
            </View>
          </View>
          <Text style={styles.footerCopy}>
            © {new Date().getFullYear()} {BRAND.name}. Licensed electrical contractor.
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Contractor login</Text>
            </TouchableOpacity>
            <Text style={styles.footerSep}>•</Text>
            <TouchableOpacity onPress={() => router.push(`/post-lead?ref=${BRAND.refCode}`)}>
              <Text style={styles.footerLink}>Get a quote</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { paddingBottom: 40 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  logoSmall: { width: 32, height: 32, borderRadius: 8 },
  brandName: { color: '#fff', fontWeight: '800', fontSize: 14 },
  loginBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#374151' },
  loginBtnText: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },

  hero: { padding: 24, paddingTop: 32, alignItems: 'center', position: 'relative' },
  heroAccentDot: {
    position: 'absolute', top: 60, right: -50, width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(0,255,102,0.08)',
  },
  heroEyebrow: {
    color: '#00ff66', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12,
  },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', lineHeight: 38 },
  heroTagline: { color: '#00ff66', fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  heroSub: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 18 },

  ctaRow: { width: '100%', marginTop: 24, gap: 10 },
  ctaPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ff66', paddingVertical: 16, borderRadius: 14,
  },
  ctaPrimaryText: { color: '#000', fontWeight: '900', fontSize: 17 },
  ctaSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#00ff66',
  },
  ctaSecondaryText: { color: '#00ff66', fontWeight: '700', fontSize: 15 },

  trustRow: { flexDirection: 'row', gap: 16, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { color: '#9ca3af', fontSize: 12 },

  section: { paddingHorizontal: 20, paddingTop: 36 },
  sectionLabel: { color: '#00ff66', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6, marginBottom: 18, lineHeight: 28 },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceCard: {
    width: '48%', backgroundColor: '#1f2937', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#374151',
  },
  serviceIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,255,102,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  serviceTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  serviceDesc: { color: '#9ca3af', fontSize: 11, marginTop: 4, lineHeight: 15 },

  whyList: { gap: 10 },
  whyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111827', padding: 12, borderRadius: 10 },
  whyIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,255,102,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  whyText: { color: '#e5e7eb', fontSize: 14, flex: 1, fontWeight: '600' },

  stepsList: { gap: 14 },
  step: { flexDirection: 'row', gap: 12 },
  stepNum: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#00ff66',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: '#000', fontWeight: '900', fontSize: 16 },
  stepTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  stepDesc: { color: '#9ca3af', fontSize: 13, marginTop: 4, lineHeight: 18 },

  areaCard: {
    marginHorizontal: 20, marginTop: 28, padding: 18,
    backgroundColor: 'rgba(0,255,102,0.06)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(0,255,102,0.3)',
  },
  areaTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 4 },
  areaText: { color: '#9ca3af', fontSize: 12, marginTop: 6, lineHeight: 18 },

  finalCta: { marginHorizontal: 20, marginTop: 36, padding: 24, backgroundColor: '#00ff66', borderRadius: 18, alignItems: 'center' },
  finalTitle: { color: '#000', fontSize: 22, fontWeight: '900' },
  finalSub: { color: '#000', fontSize: 13, marginTop: 4, opacity: 0.8 },
  finalBtn: { marginTop: 16, backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  finalBtnText: { color: '#00ff66', fontWeight: '900', fontSize: 16 },
  finalCallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  finalCallText: { color: '#000', fontWeight: '700', fontSize: 13 },

  footer: { marginTop: 36, padding: 20, borderTopWidth: 1, borderTopColor: '#1f2937' },
  footerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  footerLogo: { width: 56, height: 56, borderRadius: 12 },
  footerBrand: { color: '#fff', fontWeight: '800' },
  footerLine: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  footerCopy: { color: '#6b7280', fontSize: 11, marginTop: 16, textAlign: 'center' },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  footerLink: { color: '#00ff66', fontSize: 12, fontWeight: '700' },
  footerSep: { color: '#6b7280', fontSize: 12 },
});
