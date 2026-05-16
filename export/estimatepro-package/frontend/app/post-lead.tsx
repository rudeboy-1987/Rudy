import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { leadsApi } from '../src/services/api';

type Step = 'project' | 'contact' | 'verify_email' | 'verify_sms' | 'success';

const URGENCY = [
  { key: 'emergency', label: 'Emergency (today)' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'flexible', label: 'Flexible' },
];

const PROJECT = [
  { key: 'residential', label: 'Residential', icon: 'home' as const },
  { key: 'commercial', label: 'Commercial', icon: 'business' as const },
];

const POSTER = [
  { key: 'homeowner', label: 'Homeowner', icon: 'home-outline' as const },
  { key: 'business', label: 'Business', icon: 'briefcase-outline' as const },
];

export default function PostLeadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const refCode = (Array.isArray(params.ref) ? params.ref[0] : params.ref) || '';

  const [step, setStep] = useState<Step>('project');
  const [loading, setLoading] = useState(false);
  const [referralCompany, setReferralCompany] = useState<string | null>(null);

  // Project info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<'residential' | 'commercial'>('residential');
  const [urgency, setUrgency] = useState('this_week');
  const [budget, setBudget] = useState('');
  const [zip, setZip] = useState('');
  const [zipInfo, setZipInfo] = useState<{ city?: string; state?: string } | null>(null);
  const [images, setImages] = useState<string[]>([]);

  // Contact info
  const [posterName, setPosterName] = useState('');
  const [posterEmail, setPosterEmail] = useState('');
  const [posterPhone, setPosterPhone] = useState('');
  const [posterType, setPosterType] = useState<'homeowner' | 'business'>('homeowner');

  // Verification
  const [emailVerifId, setEmailVerifId] = useState('');
  const [smsVerifId, setSmsVerifId] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [emailDevCode, setEmailDevCode] = useState('');
  const [smsDevCode, setSmsDevCode] = useState('');
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [smsDelivered, setSmsDelivered] = useState(false);

  // Look up referral code on mount
  useEffect(() => {
    (async () => {
      if (refCode && refCode.length >= 4) {
        try {
          const res = await leadsApi.referralLookup(refCode.toUpperCase());
          setReferralCompany(res.data.company_name || null);
        } catch {
          setReferralCompany(null);
        }
      }
    })();
  }, [refCode]);

  const lookupZip = async (z: string) => {
    const cleaned = z.replace(/\D/g, '').slice(0, 5);
    setZip(cleaned);
    if (cleaned.length === 5) {
      try {
        const res = await leadsApi.zipLookup(cleaned);
        setZipInfo(res.data);
      } catch {
        setZipInfo(null);
      }
    } else {
      setZipInfo(null);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setImages((prev) => [...prev, result.assets[0].base64 as string]);
    }
  };

  const submitProject = () => {
    if (!title.trim()) return Alert.alert('Missing', 'Project title is required');
    if (!description.trim() || description.length < 20) {
      return Alert.alert('More detail please', 'Description must be at least 20 characters');
    }
    const b = parseFloat(budget.replace(/[^0-9.]/g, ''));
    if (isNaN(b) || b <= 0) return Alert.alert('Invalid budget', 'Please enter your estimated budget');
    if (zip.length !== 5 || !zipInfo) return Alert.alert('Invalid zip', 'Please enter a valid US 5-digit zip');
    setStep('contact');
  };

  const submitContact = () => {
    if (!posterName.trim()) return Alert.alert('Missing', 'Please enter your name');
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(posterEmail.trim());
    if (!emailOk) return Alert.alert('Invalid email', 'Please enter a valid email address');
    const phoneDigits = posterPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) return Alert.alert('Invalid phone', 'Please enter a valid 10-digit US phone');
    sendEmailCode();
  };

  const sendEmailCode = async () => {
    setLoading(true);
    try {
      const res = await leadsApi.sendVerification('email', posterEmail.trim().toLowerCase());
      setEmailVerifId(res.data.verification_id);
      setEmailDelivered(!!res.data.delivered);
      if (!res.data.delivered && res.data.dev_code) {
        setEmailDevCode(res.data.dev_code);
      }
      setStep('verify_email');
    } catch (e: any) {
      Alert.alert('Failed to send', e?.response?.data?.detail || 'Could not send email code');
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailCode = async () => {
    if (emailCode.trim().length !== 6) return Alert.alert('6 digits', 'Enter the 6-digit code');
    setLoading(true);
    try {
      await leadsApi.checkVerification(emailVerifId, emailCode.trim());
      sendSmsCode();
    } catch (e: any) {
      Alert.alert('Invalid code', e?.response?.data?.detail || 'Code is incorrect or expired');
    } finally {
      setLoading(false);
    }
  };

  const sendSmsCode = async () => {
    setLoading(true);
    try {
      const phoneDigits = posterPhone.replace(/\D/g, '');
      const e164 = phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`;
      const res = await leadsApi.sendVerification('sms', e164);
      setSmsVerifId(res.data.verification_id);
      setSmsDelivered(!!res.data.delivered);
      if (!res.data.delivered && res.data.dev_code) {
        setSmsDevCode(res.data.dev_code);
      }
      setStep('verify_sms');
    } catch (e: any) {
      Alert.alert('Failed to send', e?.response?.data?.detail || 'Could not send SMS code');
    } finally {
      setLoading(false);
    }
  };

  const verifySmsAndPost = async () => {
    if (smsCode.trim().length !== 6) return Alert.alert('6 digits', 'Enter the 6-digit code');
    setLoading(true);
    try {
      await leadsApi.checkVerification(smsVerifId, smsCode.trim());
      // Post the lead
      const phoneDigits = posterPhone.replace(/\D/g, '');
      const e164 = phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`;
      await leadsApi.postLead({
        poster_name: posterName.trim(),
        poster_email: posterEmail.trim().toLowerCase(),
        poster_phone: e164,
        poster_type: posterType,
        title: title.trim(),
        description: description.trim(),
        project_type: projectType,
        urgency,
        estimated_budget: parseFloat(budget.replace(/[^0-9.]/g, '')),
        zip_code: zip,
        images,
        email_verification_id: emailVerifId,
        sms_verification_id: smsVerifId,
        referral_code: refCode ? refCode.toUpperCase() : undefined,
      });
      setStep('success');
    } catch (e: any) {
      Alert.alert('Could not submit lead', e?.response?.data?.detail || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post a Job — Free</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {referralCompany && step !== 'success' ? (
            <View style={styles.refBanner}>
              <View style={styles.refIcon}>
                <Ionicons name="flash" size={16} color="#00ff66" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.refTitle}>Sent via {referralCompany}</Text>
                <Text style={styles.refSubtitle}>
                  Your job will be visible to {referralCompany} and up to 4 other verified electricians in your area.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Progress */}
          <View style={styles.progressBar}>
            {['project', 'contact', 'verify_email', 'verify_sms'].map((s, i, arr) => {
              const idx = arr.indexOf(step);
              const done = i < idx || step === 'success';
              const active = i === idx;
              return (
                <View key={s} style={[styles.progressStep, (done || active) && styles.progressStepActive]}>
                  <Text style={[styles.progressNum, (done || active) && { color: '#000' }]}>{i + 1}</Text>
                </View>
              );
            })}
          </View>

          {step === 'project' && (
            <View>
              <Text style={styles.sectionTitle}>What do you need done?</Text>
              <Text style={styles.sectionHint}>
                Describe your electrical job. The more detail, the better quotes you'll get.
              </Text>

              <Text style={styles.label}>Project title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Install 6 recessed lights in kitchen"
                placeholderTextColor="#6b7280"
                value={title}
                onChangeText={setTitle}
                maxLength={120}
              />

              <Text style={styles.label}>Description (min 20 chars)</Text>
              <TextInput
                style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                placeholder="What is the work, where is it located in the home/property, when do you need it done?"
                placeholderTextColor="#6b7280"
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={1500}
              />

              <Text style={styles.label}>Project type</Text>
              <View style={styles.toggleRow}>
                {PROJECT.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.toggleBtn, projectType === p.key && styles.toggleBtnActive]}
                    onPress={() => setProjectType(p.key as any)}
                  >
                    <Ionicons name={p.icon} size={18} color={projectType === p.key ? '#000' : '#9ca3af'} />
                    <Text style={[styles.toggleText, projectType === p.key && styles.toggleTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>When do you need it?</Text>
              <View style={styles.chipRow}>
                {URGENCY.map((u) => (
                  <TouchableOpacity
                    key={u.key}
                    style={[styles.chip, urgency === u.key && styles.chipActive]}
                    onPress={() => setUrgency(u.key)}
                  >
                    <Text style={[styles.chipText, urgency === u.key && styles.chipTextActive]}>
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Your estimated budget (USD)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 800"
                placeholderTextColor="#6b7280"
                value={budget}
                onChangeText={setBudget}
                keyboardType="number-pad"
              />

              <Text style={styles.label}>Your zip code</Text>
              <TextInput
                style={styles.input}
                placeholder="5-digit US zip"
                placeholderTextColor="#6b7280"
                value={zip}
                onChangeText={lookupZip}
                keyboardType="number-pad"
                maxLength={5}
              />
              {zipInfo?.city ? (
                <Text style={styles.helperText}>
                  <Ionicons name="checkmark-circle" size={14} color="#00ff66" />{' '}
                  {zipInfo.city}, {zipInfo.state}
                </Text>
              ) : zip.length === 5 ? (
                <Text style={[styles.helperText, { color: '#ef4444' }]}>Zip not found</Text>
              ) : null}

              <Text style={styles.label}>Photos (optional, helps get better quotes)</Text>
              <View style={styles.imageRow}>
                {images.map((b64, i) => (
                  <View key={i} style={styles.imgThumbWrap}>
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${b64}` }}
                      style={styles.imgThumb}
                    />
                    <TouchableOpacity
                      style={styles.imgRemove}
                      onPress={() => setImages(images.filter((_, idx) => idx !== i))}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 4 && (
                  <TouchableOpacity style={styles.imgAdd} onPress={pickImage}>
                    <Ionicons name="add" size={28} color="#00ff66" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={submitProject}>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          )}

          {step === 'contact' && (
            <View>
              <Text style={styles.sectionTitle}>How can pros reach you?</Text>
              <Text style={styles.sectionHint}>
                We'll verify your contact info. Only contractors who pay to unlock your lead will see your phone/email.
              </Text>

              <Text style={styles.label}>You are</Text>
              <View style={styles.toggleRow}>
                {POSTER.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.toggleBtn, posterType === p.key && styles.toggleBtnActive]}
                    onPress={() => setPosterType(p.key as any)}
                  >
                    <Ionicons name={p.icon} size={18} color={posterType === p.key ? '#000' : '#9ca3af'} />
                    <Text style={[styles.toggleText, posterType === p.key && styles.toggleTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Jane Doe"
                placeholderTextColor="#6b7280"
                value={posterName}
                onChangeText={setPosterName}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#6b7280"
                value={posterEmail}
                onChangeText={setPosterEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Mobile phone (US)</Text>
              <TextInput
                style={styles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor="#6b7280"
                value={posterPhone}
                onChangeText={setPosterPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={submitContact}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Text style={styles.primaryBtnText}>Send verification</Text>
                    <Ionicons name="mail-outline" size={18} color="#000" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep('project')}>
                <Text style={styles.backLink}>← Back to project</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'verify_email' && (
            <View>
              <Text style={styles.sectionTitle}>Verify your email</Text>
              <Text style={styles.sectionHint}>
                {emailDelivered
                  ? `We sent a 6-digit code to ${posterEmail}`
                  : `Email delivery isn't configured yet. For testing, your code is shown below.`}
              </Text>
              {emailDevCode ? (
                <View style={styles.devCodeBox}>
                  <Text style={styles.devCodeLabel}>Dev code:</Text>
                  <Text style={styles.devCodeValue}>{emailDevCode}</Text>
                </View>
              ) : null}

              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor="#6b7280"
                value={emailCode}
                onChangeText={(t) => setEmailCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={verifyEmailCode}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Verify & continue</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={sendEmailCode}>
                <Text style={styles.backLink}>Resend code</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'verify_sms' && (
            <View>
              <Text style={styles.sectionTitle}>Verify your phone</Text>
              <Text style={styles.sectionHint}>
                {smsDelivered
                  ? `We texted a 6-digit code to ${posterPhone}`
                  : `SMS not delivered. For testing, your code is shown below.`}
              </Text>
              {smsDevCode ? (
                <View style={styles.devCodeBox}>
                  <Text style={styles.devCodeLabel}>Dev code:</Text>
                  <Text style={styles.devCodeValue}>{smsDevCode}</Text>
                </View>
              ) : null}

              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor="#6b7280"
                value={smsCode}
                onChangeText={(t) => setSmsCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={verifySmsAndPost}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Text style={styles.primaryBtnText}>Verify & post lead</Text>
                    <Ionicons name="checkmark" size={18} color="#000" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={sendSmsCode}>
                <Text style={styles.backLink}>Resend code</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={60} color="#000" />
              </View>
              <Text style={styles.successTitle}>Lead posted!</Text>
              <Text style={styles.sectionHint}>
                Up to 5 local electricians will reach out shortly. We'll never share your contact info with anyone else.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { padding: 16, paddingBottom: 60 },

  refBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,255,102,0.08)',
    borderColor: '#00ff66', borderWidth: 1,
    padding: 12, borderRadius: 12, marginBottom: 14,
  },
  refIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,255,102,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  refTitle: { color: '#00ff66', fontWeight: '800', fontSize: 14 },
  refSubtitle: { color: '#9ca3af', fontSize: 11, marginTop: 2 },

  progressBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  progressStep: {
    flex: 1, height: 6, backgroundColor: '#1f2937', borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  progressStepActive: { backgroundColor: '#00ff66' },
  progressNum: { color: 'transparent', fontSize: 1 },

  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sectionHint: { color: '#9ca3af', fontSize: 13, lineHeight: 18, marginBottom: 16 },

  label: { color: '#9ca3af', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#1f2937', color: '#fff',
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#374151',
  },
  helperText: { color: '#00ff66', fontSize: 12, marginTop: 4 },

  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, backgroundColor: '#1f2937',
    borderWidth: 1, borderColor: '#374151',
  },
  toggleBtnActive: { backgroundColor: '#00ff66', borderColor: '#00ff66' },
  toggleText: { color: '#9ca3af', fontWeight: '600' },
  toggleTextActive: { color: '#000' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#1f2937' },
  chipActive: { backgroundColor: '#00ff66' },
  chipText: { color: '#9ca3af', fontSize: 13 },
  chipTextActive: { color: '#000', fontWeight: '700' },

  imageRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  imgThumbWrap: { position: 'relative' },
  imgThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#1f2937' },
  imgRemove: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#ef4444', width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  imgAdd: {
    width: 72, height: 72, borderRadius: 8, borderWidth: 2,
    borderColor: '#00ff66', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#00ff66', paddingVertical: 14, borderRadius: 12, marginTop: 24,
  },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  backLink: { color: '#9ca3af', textAlign: 'center', marginTop: 14, fontSize: 13 },

  codeInput: { fontSize: 28, fontWeight: '800', letterSpacing: 8, textAlign: 'center', height: 60 },
  devCodeBox: {
    backgroundColor: 'rgba(0,255,102,0.1)', borderColor: '#00ff66', borderWidth: 1,
    borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center',
  },
  devCodeLabel: { color: '#9ca3af', fontSize: 11, textTransform: 'uppercase' },
  devCodeValue: { color: '#00ff66', fontSize: 26, fontWeight: '800', letterSpacing: 6 },

  successWrap: { alignItems: 'center', paddingTop: 40 },
  successIcon: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#00ff66',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 8 },
});
