import React, { useState, useEffect } from 'react';
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

interface MaterialItem {
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface LaborItem {
  description: string;
  hours: number;
  rate: number;
  total: number;
}

interface EquipmentItem {
  name: string;
  days: number;
  daily_rate: number;
  total: number;
}

export default function SmartEstimateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');

  // Input state
  const [projectDescription, setProjectDescription] = useState('');
  const [projectType, setProjectType] = useState<'residential' | 'commercial'>('residential');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');

  // Editable estimate state
  const [projectName, setProjectName] = useState('');
  const [summary, setSummary] = useState('');
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [labor, setLabor] = useState<LaborItem[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [overheadPercent, setOverheadPercent] = useState('10');
  const [profitPercent, setProfitPercent] = useState('15');

  // Calculate totals
  const calculateTotals = () => {
    const materialsTotal = materials.reduce((sum, m) => sum + (m.quantity * m.unit_price), 0);
    const laborTotal = labor.reduce((sum, l) => sum + (l.hours * l.rate), 0);
    const equipmentTotal = equipment.reduce((sum, e) => sum + (e.days * e.daily_rate), 0);
    const subtotal = materialsTotal + laborTotal + equipmentTotal;
    const overhead = subtotal * (parseFloat(overheadPercent) || 0) / 100;
    const profit = (subtotal + overhead) * (parseFloat(profitPercent) || 0) / 100;
    const grandTotal = subtotal + overhead + profit;

    return {
      materials: materialsTotal,
      labor: laborTotal,
      equipment: equipmentTotal,
      subtotal,
      overhead,
      profit,
      grandTotal,
    };
  };

  const totals = calculateTotals();

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
        // Set editable state from AI response
        setProjectName(response.data.project_name || 'Electrical Project');
        setSummary(response.data.summary || '');
        setMaterials(response.data.materials || []);
        setLabor(response.data.labor || []);
        setEquipment(response.data.equipment || []);
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

  // Update material item
  const updateMaterial = (index: number, field: keyof MaterialItem, value: string) => {
    const updated = [...materials];
    if (field === 'name' || field === 'unit') {
      updated[index][field] = value;
    } else {
      updated[index][field] = parseFloat(value) || 0;
    }
    updated[index].total = updated[index].quantity * updated[index].unit_price;
    setMaterials(updated);
  };

  // Update labor item
  const updateLabor = (index: number, field: keyof LaborItem, value: string) => {
    const updated = [...labor];
    if (field === 'description') {
      updated[index][field] = value;
    } else {
      updated[index][field] = parseFloat(value) || 0;
    }
    updated[index].total = updated[index].hours * updated[index].rate;
    setLabor(updated);
  };

  // Update equipment item
  const updateEquipment = (index: number, field: keyof EquipmentItem, value: string) => {
    const updated = [...equipment];
    if (field === 'name') {
      updated[index][field] = value;
    } else {
      updated[index][field] = parseFloat(value) || 0;
    }
    updated[index].total = updated[index].days * updated[index].daily_rate;
    setEquipment(updated);
  };

  // Remove item
  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const removeLabor = (index: number) => {
    setLabor(labor.filter((_, i) => i !== index));
  };

  const removeEquipment = (index: number) => {
    setEquipment(equipment.filter((_, i) => i !== index));
  };

  // Add new item
  const addMaterial = () => {
    setMaterials([...materials, { name: 'New Material', unit: 'each', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const addLabor = () => {
    setLabor([...labor, { description: 'New Labor', hours: 1, rate: 75, total: 75 }]);
  };

  const addEquipment = () => {
    setEquipment([...equipment, { name: 'New Equipment', days: 1, daily_rate: 0, total: 0 }]);
  };

  const handleCreateEstimate = async () => {
    setLoading(true);
    try {
      // Recalculate totals for each item
      const finalMaterials = materials.map(m => ({ ...m, total: m.quantity * m.unit_price }));
      const finalLabor = labor.map(l => ({ ...l, total: l.hours * l.rate }));
      const finalEquipment = equipment.map(e => ({ ...e, total: e.days * e.daily_rate }));

      const estimateData = {
        project_name: projectName,
        project_type: projectType,
        client_name: clientName || 'Client',
        client_email: undefined,
        client_phone: undefined,
        address: address || undefined,
        description: projectDescription,
        materials: finalMaterials,
        labor: finalLabor,
        equipment: finalEquipment,
        overhead_percentage: parseFloat(overheadPercent) || 10,
        profit_percentage: parseFloat(profitPercent) || 15,
        notes: `AI-assisted estimate based on: "${projectDescription}"\n\n${summary}`,
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
        <Ionicons name="create" size={24} color="#f59e0b" />
        <Text style={styles.successText}>Edit Your Estimate</Text>
      </View>

      <Text style={styles.editHint}>
        Tap any field to adjust prices, quantities, or rates
      </Text>

      {/* Project Name */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Project Name</Text>
        <TextInput
          style={styles.editableTitle}
          value={projectName}
          onChangeText={setProjectName}
          placeholder="Project name"
          placeholderTextColor="#6b7280"
        />
      </View>

      {/* Materials */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="construct" size={20} color="#f59e0b" />
          <Text style={styles.cardHeaderTitle}>Materials</Text>
          <Text style={styles.cardHeaderTotal}>
            ${totals.materials.toFixed(2)}
          </Text>
        </View>
        
        {materials.map((item, index) => (
          <View key={index} style={styles.editableItem}>
            <View style={styles.editableItemHeader}>
              <TextInput
                style={styles.editableName}
                value={item.name}
                onChangeText={(val) => updateMaterial(index, 'name', val)}
                placeholder="Material name"
                placeholderTextColor="#6b7280"
              />
              <TouchableOpacity onPress={() => removeMaterial(index)}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View style={styles.editableRow}>
              <View style={styles.editableField}>
                <Text style={styles.fieldLabel}>Qty</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.quantity.toString()}
                  onChangeText={(val) => updateMaterial(index, 'quantity', val)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.editableField}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.unit}
                  onChangeText={(val) => updateMaterial(index, 'unit', val)}
                  placeholder="each"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.editableField}>
                <Text style={styles.fieldLabel}>Price</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.unit_price.toString()}
                  onChangeText={(val) => updateMaterial(index, 'unit_price', val)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.totalField}>
                <Text style={styles.fieldLabel}>Total</Text>
                <Text style={styles.itemTotal}>${(item.quantity * item.unit_price).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))}
        
        <TouchableOpacity style={styles.addItemButton} onPress={addMaterial}>
          <Ionicons name="add-circle-outline" size={20} color="#f59e0b" />
          <Text style={styles.addItemText}>Add Material</Text>
        </TouchableOpacity>
      </View>

      {/* Labor */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="people" size={20} color="#3b82f6" />
          <Text style={styles.cardHeaderTitle}>Labor</Text>
          <Text style={styles.cardHeaderTotal}>
            ${totals.labor.toFixed(2)}
          </Text>
        </View>
        
        {labor.map((item, index) => (
          <View key={index} style={styles.editableItem}>
            <View style={styles.editableItemHeader}>
              <TextInput
                style={styles.editableName}
                value={item.description}
                onChangeText={(val) => updateLabor(index, 'description', val)}
                placeholder="Labor description"
                placeholderTextColor="#6b7280"
              />
              <TouchableOpacity onPress={() => removeLabor(index)}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View style={styles.editableRow}>
              <View style={styles.editableField}>
                <Text style={styles.fieldLabel}>Hours</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.hours.toString()}
                  onChangeText={(val) => updateLabor(index, 'hours', val)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.editableField}>
                <Text style={styles.fieldLabel}>Rate/hr</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.rate.toString()}
                  onChangeText={(val) => updateLabor(index, 'rate', val)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.totalField}>
                <Text style={styles.fieldLabel}>Total</Text>
                <Text style={styles.itemTotal}>${(item.hours * item.rate).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))}
        
        <TouchableOpacity style={styles.addItemButton} onPress={addLabor}>
          <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
          <Text style={[styles.addItemText, { color: '#3b82f6' }]}>Add Labor</Text>
        </TouchableOpacity>
      </View>

      {/* Equipment */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="hammer" size={20} color="#8b5cf6" />
          <Text style={styles.cardHeaderTitle}>Equipment</Text>
          <Text style={styles.cardHeaderTotal}>
            ${totals.equipment.toFixed(2)}
          </Text>
        </View>
        
        {equipment.map((item, index) => (
          <View key={index} style={styles.editableItem}>
            <View style={styles.editableItemHeader}>
              <TextInput
                style={styles.editableName}
                value={item.name}
                onChangeText={(val) => updateEquipment(index, 'name', val)}
                placeholder="Equipment name"
                placeholderTextColor="#6b7280"
              />
              <TouchableOpacity onPress={() => removeEquipment(index)}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View style={styles.editableRow}>
              <View style={styles.editableField}>
                <Text style={styles.fieldLabel}>Days</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.days.toString()}
                  onChangeText={(val) => updateEquipment(index, 'days', val)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.editableField}>
                <Text style={styles.fieldLabel}>Rate/day</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.daily_rate.toString()}
                  onChangeText={(val) => updateEquipment(index, 'daily_rate', val)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.totalField}>
                <Text style={styles.fieldLabel}>Total</Text>
                <Text style={styles.itemTotal}>${(item.days * item.daily_rate).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))}
        
        <TouchableOpacity style={styles.addItemButton} onPress={addEquipment}>
          <Ionicons name="add-circle-outline" size={20} color="#8b5cf6" />
          <Text style={[styles.addItemText, { color: '#8b5cf6' }]}>Add Equipment</Text>
        </TouchableOpacity>
      </View>

      {/* Markup Settings */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="calculator" size={20} color="#10b981" />
          <Text style={styles.cardHeaderTitle}>Markup Settings</Text>
        </View>
        <View style={styles.markupRow}>
          <View style={styles.markupField}>
            <Text style={styles.fieldLabel}>Overhead %</Text>
            <TextInput
              style={styles.fieldInput}
              value={overheadPercent}
              onChangeText={setOverheadPercent}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor="#6b7280"
            />
          </View>
          <View style={styles.markupField}>
            <Text style={styles.fieldLabel}>Profit %</Text>
            <TextInput
              style={styles.fieldInput}
              value={profitPercent}
              onChangeText={setProfitPercent}
              keyboardType="numeric"
              placeholder="15"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>
      </View>

      {/* Grand Total */}
      <View style={styles.totalCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>${totals.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Overhead ({overheadPercent}%)</Text>
          <Text style={styles.totalValue}>${totals.overhead.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Profit ({profitPercent}%)</Text>
          <Text style={styles.totalValue}>${totals.profit.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>
            ${totals.grandTotal.toFixed(2)}
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
          <Text style={styles.backButtonText}>Re-analyze</Text>
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
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 12,
    gap: 8,
  },
  successText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  editHint: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
  },
  editableTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
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
  editableItem: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  editableItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editableName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 6,
    padding: 8,
    marginRight: 10,
  },
  editableRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editableField: {
    flex: 1,
  },
  totalField: {
    flex: 1,
    alignItems: 'center',
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: '#1f2937',
    borderRadius: 6,
    padding: 8,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
  itemTotal: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    marginTop: 8,
  },
  addItemText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
  markupRow: {
    flexDirection: 'row',
    gap: 16,
  },
  markupField: {
    flex: 1,
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
