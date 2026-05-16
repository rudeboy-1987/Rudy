import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api from '../src/services/api';

type Counts = Record<string, number>;
type AnalysisResult = {
  refused?: boolean;
  reason?: string;
  blueprint_kind?: string;
  project_type?: string;
  scale_detected?: string | null;
  summary?: string;
  counts?: Counts;
  materials?: any[];
  labor?: any[];
  equipment?: any[];
  totals?: {
    materials_subtotal_usd: number;
    labor_subtotal_usd: number;
    equipment_subtotal_usd: number;
    overhead_15pct_usd: number;
    profit_10pct_usd: number;
    grand_total_usd: number;
  };
  code_compliance_notes?: string[];
  warnings?: string[];
  missing_info_needed?: string[];
  analysis_id?: string;
};

export default function BlueprintVisionScreen() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]); // base64
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<'residential' | 'commercial'>('residential');
  const [description, setDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [clientName, setClientName] = useState('');
  const [creating, setCreating] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      const newImgs = result.assets.map((a: any) => a.base64).filter(Boolean) as string[];
      setImages((prev) => [...prev, ...newImgs].slice(0, 5));
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setImages((prev) => [...prev, result.assets[0].base64 as string].slice(0, 5));
      setResult(null);
    }
  };

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: false, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const file = res.assets[0];
    if (!file.uri) return;
    try {
      const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      setPdfBase64(b64);
      setPdfFilename(file.name || 'blueprint.pdf');
      setResult(null);
    } catch (e: any) {
      Alert.alert('Could not read PDF', e?.message || 'Try a different file');
    }
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));
  const clearPdf = () => { setPdfBase64(null); setPdfFilename(null); };

  const analyze = async () => {
    if (!images.length && !pdfBase64 && !description.trim()) {
      Alert.alert('Add something', 'Attach a blueprint image, PDF, or describe the project.');
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await api.post('/ai/analyze-blueprint-v2', {
        project_type: projectType,
        project_description: description,
        images,
        pdf_base64: pdfBase64,
      });
      setResult(res.data);
      if (res.data.refused) {
        Alert.alert('Not an electrical blueprint', res.data.reason || 'Please upload an electrical drawing or jobsite photo.');
      }
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.response?.data?.detail || e?.message || 'Try again');
    } finally {
      setAnalyzing(false);
    }
  };

  const createEstimate = async () => {
    if (!result || result.refused) return;
    if (!clientName.trim()) return Alert.alert('Add client name', 'Enter a client name to create the estimate.');
    setCreating(true);
    try {
      const res = await api.post('/ai/blueprint-to-estimate', {
        analysis: result,
        client_name: clientName.trim(),
        project_name: result.summary?.slice(0, 80) || 'Blueprint Estimate',
      });
      Alert.alert('Estimate created', 'Opening your new estimate...', [
        { text: 'OK', onPress: () => router.replace(`/estimate/${res.data.estimate_id}` as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.detail || 'Try again');
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setImages([]); setPdfBase64(null); setPdfFilename(null);
    setDescription(''); setResult(null); setClientName('');
  };

  const hasAttachments = images.length > 0 || !!pdfBase64;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blueprint AI Vision</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!result && (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons name="scan" size={28} color="#00ff66" />
                </View>
                <Text style={styles.heroTitle}>Upload electrical blueprints</Text>
                <Text style={styles.heroSub}>
                  GPT-4o vision will count outlets, lights, panel needs, EV chargers, NEC compliance flags,
                  and generate a complete material + labor estimate. Strictly electrical only.
                </Text>
              </View>

              <Text style={styles.label}>Project type</Text>
              <View style={styles.toggleRow}>
                {(['residential', 'commercial'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.toggleBtn, projectType === p && styles.toggleBtnActive]}
                    onPress={() => setProjectType(p)}
                  >
                    <Ionicons name={p === 'residential' ? 'home' : 'business'} size={18} color={projectType === p ? '#000' : '#9ca3af'} />
                    <Text style={[styles.toggleText, projectType === p && styles.toggleTextActive]}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Add blueprint pages (up to 5)</Text>
              <View style={styles.uploadGrid}>
                <TouchableOpacity style={styles.uploadBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color="#00ff66" />
                  <Text style={styles.uploadText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                  <Ionicons name="image" size={24} color="#00ff66" />
                  <Text style={styles.uploadText}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickPdf}>
                  <Ionicons name="document-text" size={24} color="#00ff66" />
                  <Text style={styles.uploadText}>PDF</Text>
                </TouchableOpacity>
              </View>

              {hasAttachments && (
                <View style={{ marginTop: 12 }}>
                  {pdfBase64 && (
                    <View style={styles.attachmentRow}>
                      <Ionicons name="document-text" size={20} color="#00ff66" />
                      <Text style={styles.attachmentText} numberOfLines={1}>{pdfFilename}</Text>
                      <TouchableOpacity onPress={clearPdf}>
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {images.length > 0 && (
                    <View style={styles.imageRow}>
                      {images.map((b64, i) => (
                        <View key={i} style={styles.imgThumbWrap}>
                          <Image source={{ uri: `data:image/jpeg;base64,${b64}` }} style={styles.imgThumb} />
                          <TouchableOpacity style={styles.imgRemove} onPress={() => removeImage(i)}>
                            <Ionicons name="close" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.label}>Notes for the AI (optional)</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. 1800 sqft remodel, replace knob-and-tube, 200A service upgrade, 6 recessed in kitchen…"
                placeholderTextColor="#6b7280"
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, analyzing && { opacity: 0.6 }]}
                onPress={analyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <ActivityIndicator color="#000" />
                    <Text style={styles.primaryBtnText}>Analyzing blueprints…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#000" />
                    <Text style={styles.primaryBtnText}>Run AI Vision Analysis</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.disclaimer}>
                Tip: For best accuracy, upload a clear floor plan with the legend visible. Multi-page PDF supported (first 5 pages analyzed).
              </Text>
            </>
          )}

          {result && result.refused && (
            <View style={styles.refusedCard}>
              <Ionicons name="warning" size={36} color="#ef4444" />
              <Text style={styles.refusedTitle}>Not an electrical blueprint</Text>
              <Text style={styles.refusedReason}>{result.reason}</Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
                <Text style={styles.secondaryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {result && !result.refused && (
            <AnalysisView
              result={result}
              clientName={clientName}
              setClientName={setClientName}
              onCreate={createEstimate}
              onReset={reset}
              creating={creating}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AnalysisView({ result, clientName, setClientName, onCreate, onReset, creating }: any) {
  const totals = result.totals || {};
  return (
    <View>
      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="checkmark-circle" size={20} color="#00ff66" />
          <Text style={styles.summaryHeaderText}>
            {result.blueprint_kind?.replace('_', ' ') || 'Blueprint'} analyzed
          </Text>
        </View>
        <Text style={styles.summaryText}>{result.summary || 'Analysis complete.'}</Text>
      </View>

      {/* Counts grid */}
      {result.counts && Object.keys(result.counts).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Identified items</Text>
          <View style={styles.countsGrid}>
            {Object.entries(result.counts).map(([k, v]) => (
              (v as number) > 0 ? (
                <View key={k} style={styles.countCard}>
                  <Text style={styles.countNum}>{v as number}</Text>
                  <Text style={styles.countLabel}>{prettyKey(k)}</Text>
                </View>
              ) : null
            ))}
          </View>
        </>
      )}

      {/* Totals */}
      <View style={styles.totalsCard}>
        <Text style={styles.sectionTitle}>Estimated totals</Text>
        <TotalRow label="Materials" value={totals.materials_subtotal_usd} />
        <TotalRow label="Labor" value={totals.labor_subtotal_usd} />
        <TotalRow label="Equipment" value={totals.equipment_subtotal_usd} />
        <TotalRow label="Overhead (15%)" value={totals.overhead_15pct_usd} />
        <TotalRow label="Profit (10%)" value={totals.profit_10pct_usd} />
        <View style={styles.divider} />
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Grand Total</Text>
          <Text style={styles.grandValue}>${(totals.grand_total_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      {/* Material list preview */}
      {Array.isArray(result.materials) && result.materials.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Materials ({result.materials.length})</Text>
          <View style={styles.listCard}>
            {result.materials.slice(0, 8).map((m: any, i: number) => (
              <View key={i} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{m.name}</Text>
                  <Text style={styles.lineSub}>{m.quantity} {m.unit} × ${Number(m.unit_price_estimate_usd || 0).toFixed(2)}</Text>
                </View>
                <Text style={styles.lineTotal}>${Number(m.subtotal_usd || 0).toFixed(2)}</Text>
              </View>
            ))}
            {result.materials.length > 8 && (
              <Text style={styles.moreText}>+ {result.materials.length - 8} more items</Text>
            )}
          </View>
        </>
      )}

      {/* Labor list preview */}
      {Array.isArray(result.labor) && result.labor.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Labor</Text>
          <View style={styles.listCard}>
            {result.labor.map((l: any, i: number) => (
              <View key={i} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{l.task}</Text>
                  <Text style={styles.lineSub}>{l.hours} hrs × ${Number(l.rate_usd_per_hour || 0).toFixed(2)}/hr</Text>
                </View>
                <Text style={styles.lineTotal}>${Number(l.subtotal_usd || 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Code notes */}
      {Array.isArray(result.code_compliance_notes) && result.code_compliance_notes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>NEC compliance notes</Text>
          <View style={styles.listCard}>
            {result.code_compliance_notes.map((n: string, i: number) => (
              <View key={i} style={styles.noteRow}>
                <Ionicons name="shield-checkmark" size={14} color="#00ff66" style={{ marginTop: 3 }} />
                <Text style={styles.noteText}>{n}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Warnings */}
      {Array.isArray(result.warnings) && result.warnings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>⚠️ Heads up</Text>
          <View style={styles.warningCard}>
            {result.warnings.map((w: string, i: number) => (
              <Text key={i} style={styles.warningText}>• {w}</Text>
            ))}
          </View>
        </>
      )}

      {/* Missing info */}
      {Array.isArray(result.missing_info_needed) && result.missing_info_needed.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>For better accuracy, provide:</Text>
          <View style={styles.listCard}>
            {result.missing_info_needed.map((n: string, i: number) => (
              <View key={i} style={styles.noteRow}>
                <Ionicons name="information-circle" size={14} color="#3b82f6" style={{ marginTop: 3 }} />
                <Text style={styles.noteText}>{n}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Save as estimate */}
      <View style={styles.actionCard}>
        <Text style={styles.actionTitle}>Save as estimate</Text>
        <TextInput
          style={styles.input}
          placeholder="Client name"
          placeholderTextColor="#6b7280"
          value={clientName}
          onChangeText={setClientName}
        />
        <TouchableOpacity
          style={[styles.primaryBtn, creating && { opacity: 0.6 }]}
          onPress={onCreate}
          disabled={creating}
        >
          {creating ? (
            <>
              <ActivityIndicator color="#000" />
              <Text style={styles.primaryBtnText}>Creating…</Text>
            </>
          ) : (
            <>
              <Ionicons name="save" size={18} color="#000" />
              <Text style={styles.primaryBtnText}>Create editable estimate</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onReset}>
          <Text style={styles.secondaryBtnText}>Analyze another blueprint</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>${Number(value || 0).toFixed(2)}</Text>
    </View>
  );
}

function prettyKey(k: string) {
  return k.replace(/_/g, ' ').replace(/(^|\s)\S/g, (t) => t.toUpperCase());
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 60 },

  heroCard: {
    backgroundColor: 'rgba(0,255,102,0.06)', borderColor: '#00ff66', borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,255,102,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  heroSub: { color: '#9ca3af', fontSize: 12, textAlign: 'center', lineHeight: 16 },

  label: { color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 6, letterSpacing: 0.4 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, backgroundColor: '#1f2937',
    borderWidth: 1, borderColor: '#374151',
  },
  toggleBtnActive: { backgroundColor: '#00ff66', borderColor: '#00ff66' },
  toggleText: { color: '#9ca3af', fontWeight: '700' },
  toggleTextActive: { color: '#000' },

  uploadGrid: { flexDirection: 'row', gap: 8 },
  uploadBtn: {
    flex: 1, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1f2937', borderRadius: 12, borderWidth: 1, borderColor: '#374151',
  },
  uploadText: { color: '#9ca3af', fontWeight: '700', fontSize: 12 },

  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  imgThumbWrap: { position: 'relative' },
  imgThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#1f2937' },
  imgRemove: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444',
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  attachmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1f2937', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#374151', marginBottom: 8,
  },
  attachmentText: { flex: 1, color: '#fff', fontSize: 13 },

  input: {
    backgroundColor: '#1f2937', color: '#fff',
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#374151',
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ff66', paddingVertical: 14, borderRadius: 12, marginTop: 16,
  },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#00ff66', paddingVertical: 12, borderRadius: 12, marginTop: 10,
  },
  secondaryBtnText: { color: '#00ff66', fontWeight: '700' },
  disclaimer: { color: '#6b7280', fontSize: 12, marginTop: 10, textAlign: 'center' },

  refusedCard: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderColor: '#ef4444', borderWidth: 1,
    borderRadius: 14, padding: 20, alignItems: 'center', marginTop: 12,
  },
  refusedTitle: { color: '#ef4444', fontSize: 18, fontWeight: '800', marginTop: 8 },
  refusedReason: { color: '#fca5a5', fontSize: 13, marginTop: 6, textAlign: 'center' },

  summaryCard: {
    backgroundColor: 'rgba(0,255,102,0.06)', borderColor: '#00ff66', borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  summaryHeaderText: { color: '#00ff66', fontWeight: '800', textTransform: 'capitalize' },
  summaryText: { color: '#e5e7eb', fontSize: 13, lineHeight: 18 },

  sectionTitle: { color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', fontWeight: '700', marginTop: 14, marginBottom: 6 },
  countsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countCard: {
    width: '31%', backgroundColor: '#1f2937', borderRadius: 10, padding: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#374151',
  },
  countNum: { color: '#00ff66', fontSize: 22, fontWeight: '900' },
  countLabel: { color: '#9ca3af', fontSize: 10, textAlign: 'center', marginTop: 4 },

  totalsCard: {
    backgroundColor: '#1f2937', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#374151', marginTop: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { color: '#9ca3af' },
  totalValue: { color: '#fff', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#374151', marginVertical: 8 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  grandValue: { color: '#00ff66', fontSize: 22, fontWeight: '900' },

  listCard: {
    backgroundColor: '#1f2937', borderRadius: 14, padding: 8,
    borderWidth: 1, borderColor: '#374151',
  },
  lineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: '#374151',
  },
  lineName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  lineSub: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  lineTotal: { color: '#00ff66', fontWeight: '700' },
  moreText: { color: '#6b7280', fontSize: 12, padding: 8, textAlign: 'center' },

  warningCard: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderColor: '#fbbf24', borderWidth: 1,
    borderRadius: 12, padding: 12,
  },
  warningText: { color: '#fbbf24', fontSize: 13, marginVertical: 2 },
  noteRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, paddingHorizontal: 4 },
  noteText: { color: '#e5e7eb', fontSize: 12, flex: 1, lineHeight: 17 },

  actionCard: { marginTop: 14 },
  actionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 8 },
});
