import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { aiApi, estimatesApi } from '../src/services/api';

export default function SmartEstimateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');

  // Input state
  const [projectDescription, setProjectDescription] = useState('');
  const [projectType, setProjectType] = useState<'residential' | 'commercial'>('residential');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');

  // AI-generated estimate state
  const [generatedEstimate, setGeneratedEstimate] = useState<any>(null);

  const examplePrompts = [
    "I need to rewire my kitchen with 6 GFCI outlets, 4 recessed lights, and under-cabinet lighting",
    "Complete electrical for a 2000 sq ft home addition including panel upgrade to 200A",
    "Install EV charger in garage with new 50A circuit from main panel",
    "Office rewiring: 20 outlets, 10 data drops, LED panel lights for 5 rooms",
  ];

  const handleAnalyze = async () => {
    if (!projectDescription.trim()) {
      Alert.alert('Error', 'Please describe your project');
      return;
    }

    setLoading(true);
    try {
      const response = await aiApi.analyzeProject(
        projectDescription,
        projectType,
        clientName || undefined,
        address || undefined
      );

      if (response.data.success) {
        setGeneratedEstimate(response.data);
        setStep('review');
      } else {
        Alert.alert('AI Analysis', response.data.raw_analysis || response.data.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to analyze project');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEstimate = async () => {
    if (!generatedEstimate) return;

    setLoading(true);
    try {
      const estimateData = {
        project_name: generatedEstimate.project_name,
        project_type: generatedEstimate.project_type,
        client_name: generatedEstimate.client_name || clientName || 'Client',
        client_email: undefined,
        client_phone: undefined,
        address: generatedEstimate.address || address,
        description: projectDescription,
        materials: generatedEstimate.materials || [],
        labor: generatedEstimate.labor || [],
        equipment: generatedEstimate.equipment || [],
        overhead_percentage: 10,
        profit_percentage: 15,
        notes: `AI-generated estimate based on: "${projectDescription}"\n\n${generatedEstimate.summary || ''}`,
      };

      const response = await estimatesApi.create(estimateData);
      Alert.alert('Success', 'Estimate created successfully!', [
        { text: 'View Estimate', onPress: () => router.replace(`/estimate/${response.data.id}`) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create estimate');
    } finally {
      setLoading(false);
    }
  };

  const renderInputStep = () => (
    <>
      {/* AI Badge */}
      <View style={styles.aiBadge}>
        <Ionicons name="sparkles" size={20} color="#f59e0b" />
        <Text style={styles.aiBadgeText}>Smart AI Estimator</Text>
      </View>

      <Text style={styles.subtitle}>
        Describe your project in plain English and AI will break it down into a detailed estimate
      </Text>

      {/* Project Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project Type</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, projectType === 'residential' && styles.toggleActive]}
            onPress={() => setProjectType('residential')}
          >
            <Ionicons
              name="home"
              size={20}
              color={projectType === 'residential' ? '#000' : '#9ca3af'}
            />
            <Text
              style={[styles.toggleText, projectType === 'residential' && styles.toggleTextActive]}
            >
              Residential
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, projectType === 'commercial' && styles.toggleActive]}
            onPress={() => setProjectType('commercial')}
          >
            <Ionicons
              name="business"
              size={20}
              color={projectType === 'commercial' ? '#000' : '#9ca3af'}
            />
            <Text
              style={[styles.toggleText, projectType === 'commercial' && styles.toggleTextActive]}
            >
              Commercial
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Client Info (Optional) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Client Info (Optional)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Client name"
            placeholderTextColor="#6b7280"
            value={clientName}
            onChangeText={setClientName}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 8 }]}
            placeholder="Address"
            placeholderTextColor="#6b7280"
            value={address}
            onChangeText={setAddress}
          />
        </View>
      </View>

      {/* Project Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Describe Your Project *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Tell us what you need in your own words...

Example: I need to rewire my kitchen with 6 GFCI outlets near the counters, 4 recessed LED lights, and under-cabinet lighting. Also need to upgrade the circuit breaker for the new appliances."
          placeholderTextColor="#6b7280"
          value={projectDescription}
          onChangeText={setProjectDescription}
          multiline
          numberOfLines={8}
        />
        <Text style={styles.charCount}>{projectDescription.length} characters</Text>
      </View>

      {/* Example Prompts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Example Descriptions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.examplesRow}>
            {examplePrompts.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={styles.exampleChip}
                onPress={() => setProjectDescription(prompt)}
              >
                <Text style={styles.exampleText} numberOfLines={2}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Analyze Button */}
      <TouchableOpacity
        style={[styles.analyzeButton, loading && styles.buttonDisabled]}
        onPress={handleAnalyze}
        disabled={loading}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#000" />
            <Text style={styles.analyzeButtonText}>Analyzing...</Text>
          </>
        ) : (
          <>
            <Ionicons name="sparkles" size={24} color="#000" />
            <Text style={styles.analyzeButtonText}>Generate Smart Estimate</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );

  const renderReviewStep = () => (
    <>
      <View style={styles.successBadge}>
        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
        <Text style={styles.successText}>AI Analysis Complete</Text>
      </View>

      {generatedEstimate && (
        <>
          {/* Project Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{generatedEstimate.project_name}</Text>
            <Text style={styles.cardSubtitle}>{generatedEstimate.summary}</Text>
          </View>

          {/* Materials */}
          {generatedEstimate.materials?.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="construct" size={20} color="#f59e0b" />
                <Text style={styles.cardHeaderTitle}>Materials</Text>
                <Text style={styles.cardHeaderTotal}>
                  ${generatedEstimate.totals?.materials?.toLocaleString()}
                </Text>
              </View>
              {generatedEstimate.materials.map((item: any, index: number) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemDetails}>
                      {item.quantity} {item.unit} @ ${item.unit_price}
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>${item.total?.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Labor */}
          {generatedEstimate.labor?.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="people" size={20} color="#3b82f6" />
                <Text style={styles.cardHeaderTitle}>Labor</Text>
                <Text style={styles.cardHeaderTotal}>
                  ${generatedEstimate.totals?.labor?.toLocaleString()}
                </Text>
              </View>
              {generatedEstimate.labor.map((item: any, index: number) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemName}>{item.description}</Text>
                    <Text style={styles.lineItemDetails}>
                      {item.hours} hrs @ ${item.rate}/hr
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>${item.total?.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Equipment */}
          {generatedEstimate.equipment?.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="hammer" size={20} color="#8b5cf6" />
                <Text style={styles.cardHeaderTitle}>Equipment</Text>
                <Text style={styles.cardHeaderTotal}>
                  ${generatedEstimate.totals?.equipment?.toLocaleString()}
                </Text>
              </View>
              {generatedEstimate.equipment.map((item: any, index: number) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemDetails}>
                      {item.days} days @ ${item.daily_rate}/day
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>${item.total?.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Grand Total */}
          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${generatedEstimate.totals?.subtotal?.toLocaleString()}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Overhead (10%)</Text>
              <Text style={styles.totalValue}>${generatedEstimate.totals?.overhead?.toLocaleString()}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Profit (15%)</Text>
              <Text style={styles.totalValue}>${generatedEstimate.totals?.profit?.toLocaleString()}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>
                ${generatedEstimate.totals?.grand_total?.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('input')}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.backButtonText}>Edit Description</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleCreateEstimate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#000" />
                  <Text style={styles.createButtonText}>Create Estimate</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>Smart Estimate</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {step === 'input' ? renderInputStep() : renderReviewStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 16,
    gap: 8,
  },
  aiBadgeText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  toggleActive: {
    backgroundColor: '#f59e0b',
  },
  toggleText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#000000',
  },
  row: {
    flexDirection: 'row',
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  textArea: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  examplesRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  exampleChip: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    width: 200,
    borderWidth: 1,
    borderColor: '#374151',
  },
  exampleText: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    marginTop: 8,
  },
  analyzeButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 24,
    gap: 8,
  },
  successText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  cardHeaderTotal: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemName: {
    color: '#ffffff',
    fontSize: 14,
  },
  lineItemDetails: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  lineItemTotal: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  totalCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  totalValue: {
    color: '#ffffff',
    fontSize: 14,
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#f59e0b',
    marginTop: 8,
    paddingTop: 16,
  },
  grandTotalLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  grandTotalValue: {
    color: '#10b981',
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  createButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
