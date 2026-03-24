import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { estimatesApi, aiApi, Estimate, emailApi } from '../../src/services/api';
import { format } from 'date-fns';

export default function EstimateDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const loadEstimate = useCallback(async () => {
    if (!id) return;
    try {
      const response = await estimatesApi.getOne(id);
      setEstimate(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load estimate');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEstimate();
  }, [loadEstimate]);

  const handleGenerateAI = async () => {
    if (!estimate) return;
    setGenerating(true);
    try {
      const response = await aiApi.generateEstimate(estimate.id);
      Alert.alert('Success', 'AI document generated!', [
        { text: 'OK', onPress: () => loadEstimate() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEstimate = async () => {
    if (!estimate?.client_email) {
      Alert.alert('Error', 'No client email on record');
      return;
    }
    setSending(true);
    try {
      const response = await emailApi.sendEstimate(estimate.id, estimate.client_email);
      const message = response.data.mocked 
        ? `${response.data.message}` 
        : `Estimate sent successfully to ${estimate.client_email}`;
      Alert.alert('Success', message, [
        { text: 'OK', onPress: () => loadEstimate() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to send estimate');
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    if (!estimate) return;
    try {
      await Share.share({
        title: `Estimate: ${estimate.project_name}`,
        message: `Estimate for ${estimate.client_name}\nProject: ${estimate.project_name}\nTotal: $${estimate.grand_total?.toLocaleString()}\n\n${estimate.ai_analysis || ''}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Estimate', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await estimatesApi.delete(estimate!.id);
            router.replace('/(tabs)/estimates');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  if (!estimate) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Estimate not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Estimate</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  estimate.status === 'sent'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : estimate.status === 'accepted'
                    ? 'rgba(59, 130, 246, 0.1)'
                    : 'rgba(245, 158, 11, 0.1)',
              },
            ]}
          >
            <Ionicons
              name={
                estimate.status === 'sent'
                  ? 'checkmark-circle'
                  : estimate.status === 'accepted'
                  ? 'checkmark-done-circle'
                  : 'time'
              }
              size={16}
              color={
                estimate.status === 'sent'
                  ? '#10b981'
                  : estimate.status === 'accepted'
                  ? '#3b82f6'
                  : '#f59e0b'
              }
            />
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    estimate.status === 'sent'
                      ? '#10b981'
                      : estimate.status === 'accepted'
                      ? '#3b82f6'
                      : '#f59e0b',
                },
              ]}
            >
              {estimate.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.dateText}>
            Created {format(new Date(estimate.created_at), 'MMM d, yyyy')}
          </Text>
        </View>

        {/* Project Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color="#f59e0b" />
            <Text style={styles.cardTitle}>Project Details</Text>
          </View>
          <Text style={styles.projectName}>{estimate.project_name}</Text>
          <View style={styles.projectTypeBadge}>
            <Ionicons
              name={estimate.project_type === 'residential' ? 'home' : 'business'}
              size={14}
              color="#9ca3af"
            />
            <Text style={styles.projectTypeText}>{estimate.project_type}</Text>
          </View>
          {estimate.description && (
            <Text style={styles.description}>{estimate.description}</Text>
          )}
        </View>

        {/* Client Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={24} color="#3b82f6" />
            <Text style={styles.cardTitle}>Client Information</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{estimate.client_name}</Text>
          </View>
          {estimate.client_email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{estimate.client_email}</Text>
            </View>
          )}
          {estimate.client_phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{estimate.client_phone}</Text>
            </View>
          )}
          {estimate.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{estimate.address}</Text>
            </View>
          )}
        </View>

        {/* Cost Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calculator" size={24} color="#10b981" />
            <Text style={styles.cardTitle}>Cost Breakdown</Text>
          </View>

          {estimate.materials.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Materials ({estimate.materials.length})</Text>
              {estimate.materials.map((item, index) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemDetails}>
                      {item.quantity} {item.unit} @ ${item.unit_price}
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>${item.total.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {estimate.labor.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Labor ({estimate.labor.length})</Text>
              {estimate.labor.map((item, index) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemName}>{item.description}</Text>
                    <Text style={styles.lineItemDetails}>
                      {item.hours} hrs @ ${item.rate}/hr
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>${item.total.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {estimate.equipment.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Equipment ({estimate.equipment.length})</Text>
              {estimate.equipment.map((item, index) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemDetails}>
                      {item.days} days @ ${item.daily_rate}/day
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>${item.total.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${estimate.subtotal?.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Overhead ({estimate.overhead_percentage}%)</Text>
              <Text style={styles.totalValue}>${estimate.overhead_amount?.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Profit ({estimate.profit_percentage}%)</Text>
              <Text style={styles.totalValue}>${estimate.profit_amount?.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>${estimate.grand_total?.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* AI Analysis */}
        {estimate.ai_analysis && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={24} color="#f59e0b" />
              <Text style={styles.cardTitle}>AI Generated Document</Text>
            </View>
            <Text style={styles.aiText}>{estimate.ai_analysis}</Text>
          </View>
        )}

        {/* Notes */}
        {estimate.notes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document" size={24} color="#8b5cf6" />
              <Text style={styles.cardTitle}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{estimate.notes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.aiButton]}
            onPress={handleGenerateAI}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Ionicons name="sparkles" size={20} color="#000" />
            )}
            <Text style={styles.aiButtonText}>
              {generating ? 'Generating...' : 'Generate AI Document'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.sendButton]}
            onPress={handleSendEstimate}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
            <Text style={styles.sendButtonText}>
              {sending ? 'Sending...' : 'Send to Client'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.deleteButtonText}>Delete Estimate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
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
  shareButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    color: '#6b7280',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  projectName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  projectTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  projectTypeText: {
    color: '#9ca3af',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  description: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
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
  totalsSection: {
    borderTopWidth: 2,
    borderTopColor: '#374151',
    paddingTop: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
    paddingTop: 12,
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
  aiText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 22,
  },
  notesText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  aiButton: {
    backgroundColor: '#f59e0b',
  },
  aiButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
