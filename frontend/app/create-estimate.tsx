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
import { estimatesApi, MaterialItem, LaborItem, EquipmentItem } from '../src/services/api';

export default function CreateEstimateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1: Project Info
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<'residential' | 'commercial'>('residential');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Materials
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [newMaterial, setNewMaterial] = useState<Partial<MaterialItem>>({
    name: '',
    unit: 'each',
    quantity: 0,
    unit_price: 0,
    total: 0,
  });

  // Step 3: Labor
  const [labor, setLabor] = useState<LaborItem[]>([]);
  const [newLabor, setNewLabor] = useState<Partial<LaborItem>>({
    description: '',
    hours: 0,
    rate: 75,
    total: 0,
  });

  // Step 4: Equipment
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [newEquipment, setNewEquipment] = useState<Partial<EquipmentItem>>({
    name: '',
    days: 0,
    daily_rate: 0,
    total: 0,
  });

  // Step 5: Markup
  const [overheadPercentage, setOverheadPercentage] = useState('10');
  const [profitPercentage, setProfitPercentage] = useState('15');
  const [notes, setNotes] = useState('');

  const addMaterial = () => {
    if (!newMaterial.name || !newMaterial.quantity || !newMaterial.unit_price) {
      Alert.alert('Error', 'Please fill in all material fields');
      return;
    }
    const total = (newMaterial.quantity || 0) * (newMaterial.unit_price || 0);
    setMaterials([...materials, { ...newMaterial, total } as MaterialItem]);
    setNewMaterial({ name: '', unit: 'each', quantity: 0, unit_price: 0, total: 0 });
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const addLabor = () => {
    if (!newLabor.description || !newLabor.hours) {
      Alert.alert('Error', 'Please fill in labor description and hours');
      return;
    }
    const total = (newLabor.hours || 0) * (newLabor.rate || 75);
    setLabor([...labor, { ...newLabor, total } as LaborItem]);
    setNewLabor({ description: '', hours: 0, rate: 75, total: 0 });
  };

  const removeLabor = (index: number) => {
    setLabor(labor.filter((_, i) => i !== index));
  };

  const addEquipment = () => {
    if (!newEquipment.name || !newEquipment.days || !newEquipment.daily_rate) {
      Alert.alert('Error', 'Please fill in all equipment fields');
      return;
    }
    const total = (newEquipment.days || 0) * (newEquipment.daily_rate || 0);
    setEquipment([...equipment, { ...newEquipment, total } as EquipmentItem]);
    setNewEquipment({ name: '', days: 0, daily_rate: 0, total: 0 });
  };

  const removeEquipment = (index: number) => {
    setEquipment(equipment.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const materialsTotal = materials.reduce((sum, m) => sum + m.total, 0);
    const laborTotal = labor.reduce((sum, l) => sum + l.total, 0);
    const equipmentTotal = equipment.reduce((sum, e) => sum + e.total, 0);
    const subtotal = materialsTotal + laborTotal + equipmentTotal;
    const overhead = subtotal * (parseFloat(overheadPercentage) / 100);
    const profit = (subtotal + overhead) * (parseFloat(profitPercentage) / 100);
    const grandTotal = subtotal + overhead + profit;

    return { materialsTotal, laborTotal, equipmentTotal, subtotal, overhead, profit, grandTotal };
  };

  const handleSubmit = async () => {
    if (!projectName || !clientName) {
      Alert.alert('Error', 'Please fill in project name and client name');
      return;
    }

    setLoading(true);
    try {
      const estimateData = {
        project_name: projectName,
        project_type: projectType,
        client_name: clientName,
        client_email: clientEmail || undefined,
        client_phone: clientPhone || undefined,
        address: address || undefined,
        description: description || undefined,
        materials,
        labor,
        equipment,
        overhead_percentage: parseFloat(overheadPercentage),
        profit_percentage: parseFloat(profitPercentage),
        notes: notes || undefined,
      };

      const response = await estimatesApi.create(estimateData);
      Alert.alert('Success', 'Estimate created successfully', [
        { text: 'View Estimate', onPress: () => router.replace(`/estimate/${response.data.id}`) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create estimate');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Project Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Project Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Kitchen Rewiring"
          placeholderTextColor="#6b7280"
          value={projectName}
          onChangeText={setProjectName}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Project Type</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, projectType === 'residential' && styles.toggleActive]}
            onPress={() => setProjectType('residential')}
          >
            <Ionicons name="home" size={18} color={projectType === 'residential' ? '#000' : '#9ca3af'} />
            <Text style={[styles.toggleText, projectType === 'residential' && styles.toggleTextActive]}>
              Residential
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, projectType === 'commercial' && styles.toggleActive]}
            onPress={() => setProjectType('commercial')}
          >
            <Ionicons name="business" size={18} color={projectType === 'commercial' ? '#000' : '#9ca3af'} />
            <Text style={[styles.toggleText, projectType === 'commercial' && styles.toggleTextActive]}>
              Commercial
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Client Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Client's full name"
          placeholderTextColor="#6b7280"
          value={clientName}
          onChangeText={setClientName}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="client@email.com"
            placeholderTextColor="#6b7280"
            value={clientEmail}
            onChangeText={setClientEmail}
            keyboardType="email-address"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 123-4567"
            placeholderTextColor="#6b7280"
            value={clientPhone}
            onChangeText={setClientPhone}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Project address"
          placeholderTextColor="#6b7280"
          value={address}
          onChangeText={setAddress}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Brief description of the project..."
          placeholderTextColor="#6b7280"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Materials</Text>

      {/* Add Material Form */}
      <View style={styles.addItemCard}>
        <TextInput
          style={styles.input}
          placeholder="Material name"
          placeholderTextColor="#6b7280"
          value={newMaterial.name}
          onChangeText={(text) => setNewMaterial({ ...newMaterial, name: text })}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Qty"
            placeholderTextColor="#6b7280"
            value={newMaterial.quantity?.toString() || ''}
            onChangeText={(text) => setNewMaterial({ ...newMaterial, quantity: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Unit"
            placeholderTextColor="#6b7280"
            value={newMaterial.unit}
            onChangeText={(text) => setNewMaterial({ ...newMaterial, unit: text })}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Price"
            placeholderTextColor="#6b7280"
            value={newMaterial.unit_price?.toString() || ''}
            onChangeText={(text) => setNewMaterial({ ...newMaterial, unit_price: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addMaterial}>
          <Ionicons name="add" size={20} color="#000" />
          <Text style={styles.addButtonText}>Add Material</Text>
        </TouchableOpacity>
      </View>

      {/* Materials List */}
      {materials.map((item, index) => (
        <View key={index} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetails}>
              {item.quantity} {item.unit} @ ${item.unit_price}
            </Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.itemTotal}>${item.total.toFixed(2)}</Text>
            <TouchableOpacity onPress={() => removeMaterial(index)}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {materials.length > 0 && (
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Materials Total:</Text>
          <Text style={styles.subtotalValue}>${totals.materialsTotal.toFixed(2)}</Text>
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Labor</Text>

      {/* Add Labor Form */}
      <View style={styles.addItemCard}>
        <TextInput
          style={styles.input}
          placeholder="Labor description"
          placeholderTextColor="#6b7280"
          value={newLabor.description}
          onChangeText={(text) => setNewLabor({ ...newLabor, description: text })}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Hours"
            placeholderTextColor="#6b7280"
            value={newLabor.hours?.toString() || ''}
            onChangeText={(text) => setNewLabor({ ...newLabor, hours: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Rate/hr"
            placeholderTextColor="#6b7280"
            value={newLabor.rate?.toString() || ''}
            onChangeText={(text) => setNewLabor({ ...newLabor, rate: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addLabor}>
          <Ionicons name="add" size={20} color="#000" />
          <Text style={styles.addButtonText}>Add Labor</Text>
        </TouchableOpacity>
      </View>

      {/* Labor List */}
      {labor.map((item, index) => (
        <View key={index} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.description}</Text>
            <Text style={styles.itemDetails}>
              {item.hours} hrs @ ${item.rate}/hr
            </Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.itemTotal}>${item.total.toFixed(2)}</Text>
            <TouchableOpacity onPress={() => removeLabor(index)}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {labor.length > 0 && (
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Labor Total:</Text>
          <Text style={styles.subtotalValue}>${totals.laborTotal.toFixed(2)}</Text>
        </View>
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Equipment Rental</Text>

      {/* Add Equipment Form */}
      <View style={styles.addItemCard}>
        <TextInput
          style={styles.input}
          placeholder="Equipment name"
          placeholderTextColor="#6b7280"
          value={newEquipment.name}
          onChangeText={(text) => setNewEquipment({ ...newEquipment, name: text })}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Days"
            placeholderTextColor="#6b7280"
            value={newEquipment.days?.toString() || ''}
            onChangeText={(text) => setNewEquipment({ ...newEquipment, days: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Daily Rate"
            placeholderTextColor="#6b7280"
            value={newEquipment.daily_rate?.toString() || ''}
            onChangeText={(text) => setNewEquipment({ ...newEquipment, daily_rate: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addEquipment}>
          <Ionicons name="add" size={20} color="#000" />
          <Text style={styles.addButtonText}>Add Equipment</Text>
        </TouchableOpacity>
      </View>

      {/* Equipment List */}
      {equipment.map((item, index) => (
        <View key={index} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetails}>
              {item.days} days @ ${item.daily_rate}/day
            </Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.itemTotal}>${item.total.toFixed(2)}</Text>
            <TouchableOpacity onPress={() => removeEquipment(index)}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {equipment.length > 0 && (
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Equipment Total:</Text>
          <Text style={styles.subtotalValue}>${totals.equipmentTotal.toFixed(2)}</Text>
        </View>
      )}
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review & Finalize</Text>

      {/* Markup Settings */}
      <View style={styles.markupCard}>
        <Text style={styles.markupTitle}>Markup Settings</Text>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Overhead %</Text>
            <TextInput
              style={styles.input}
              value={overheadPercentage}
              onChangeText={setOverheadPercentage}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Profit %</Text>
            <TextInput
              style={styles.input}
              value={profitPercentage}
              onChangeText={setProfitPercentage}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Additional Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Terms, conditions, special notes..."
          placeholderTextColor="#6b7280"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Estimate Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Materials</Text>
          <Text style={styles.summaryValue}>${totals.materialsTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Labor</Text>
          <Text style={styles.summaryValue}>${totals.laborTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Equipment</Text>
          <Text style={styles.summaryValue}>${totals.equipmentTotal.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summarySubtotal]}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>${totals.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Overhead ({overheadPercentage}%)</Text>
          <Text style={styles.summaryValue}>${totals.overhead.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Profit ({profitPercentage}%)</Text>
          <Text style={styles.summaryValue}>${totals.profit.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalValue}>${totals.grandTotal.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>New Estimate</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progress}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View
              key={s}
              style={[
                styles.progressStep,
                s <= step && styles.progressStepActive,
                s === step && styles.progressStepCurrent,
              ]}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < 5 ? (
            <TouchableOpacity
              style={[styles.primaryButton, step === 1 && { flex: 1 }]}
              onPress={() => setStep(step + 1)}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Create Estimate</Text>
                  <Ionicons name="checkmark" size={20} color="#000" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
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
  backButton: {
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
  progress: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#f59e0b',
  },
  progressStepCurrent: {
    backgroundColor: '#f59e0b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  stepContent: {},
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
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
  addItemCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  addButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  itemDetails: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  itemTotal: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    marginTop: 8,
  },
  subtotalLabel: {
    color: '#9ca3af',
    fontSize: 16,
  },
  subtotalValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  markupCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  markupTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  summaryTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summarySubtotal: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    marginTop: 8,
    paddingTop: 16,
  },
  summaryTotal: {
    borderTopWidth: 2,
    borderTopColor: '#f59e0b',
    marginTop: 8,
    paddingTop: 16,
  },
  summaryLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  totalValue: {
    color: '#10b981',
    fontSize: 24,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
