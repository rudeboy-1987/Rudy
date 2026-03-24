import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { estimatesApi, subscriptionApi, Estimate } from '../../src/services/api';
import { format } from 'date-fns';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [estRes, subRes] = await Promise.all([
        estimatesApi.getAll(),
        subscriptionApi.getStatus(),
      ]);
      setEstimates(estRes.data);
      setSubscription(subRes.data);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const recentEstimates = estimates.slice(0, 3);
  const totalRevenue = estimates.reduce((sum, est) => sum + (est.grand_total || 0), 0);
  const draftCount = estimates.filter((e) => e.status === 'draft').length;
  const sentCount = estimates.filter((e) => e.status === 'sent').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.companyName}>{user?.company_name || 'Contractor'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Subscription Banner */}
        {subscription && (
          <View style={styles.subscriptionBanner}>
            <View style={styles.subscriptionContent}>
              <Ionicons
                name={subscription.tier === 'premium' ? 'star' : subscription.tier === 'basic' ? 'checkmark-circle' : 'gift'}
                size={24}
                color={subscription.tier === 'premium' ? '#f59e0b' : '#10b981'}
              />
              <View style={styles.subscriptionText}>
                <Text style={styles.subscriptionTitle}>
                  {subscription.tier === 'free_trial'
                    ? `Free Trial - ${subscription.days_remaining} days left`
                    : subscription.tier === 'basic'
                    ? 'Basic Plan'
                    : 'Premium Plan'}
                </Text>
                <Text style={styles.subscriptionSubtitle}>
                  {subscription.tier === 'free_trial'
                    ? 'Upgrade to continue after trial'
                    : subscription.tier === 'premium'
                    ? 'Job board access included'
                    : 'Upgrade for job board access'}
                </Text>
              </View>
            </View>
            {subscription.tier !== 'premium' && (
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Text style={styles.upgradeBtnText}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Ionicons name="document-text" size={28} color="#f59e0b" />
            <Text style={styles.statNumber}>{estimates.length}</Text>
            <Text style={styles.statLabel}>Total Estimates</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash" size={28} color="#10b981" />
            <Text style={styles.statNumber}>${totalRevenue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>{draftCount}</Text>
            <Text style={styles.statLabel}>Drafts</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="send" size={28} color="#8b5cf6" />
            <Text style={styles.statNumber}>{sentCount}</Text>
            <Text style={styles.statLabel}>Sent</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/smart-estimate')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="sparkles" size={28} color="#f59e0b" />
              </View>
              <Text style={styles.actionText}>Smart Estimate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/create-estimate')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="add-circle" size={28} color="#10b981" />
              </View>
              <Text style={styles.actionText}>Manual Estimate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/blueprint-analyzer')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="scan" size={28} color="#3b82f6" />
              </View>
              <Text style={styles.actionText}>Analyze Blueprint</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/materials')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <Ionicons name="pricetags" size={28} color="#8b5cf6" />
              </View>
              <Text style={styles.actionText}>Material Prices</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Estimates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Estimates</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/estimates')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentEstimates.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={48} color="#4b5563" />
              <Text style={styles.emptyText}>No estimates yet</Text>
              <Text style={styles.emptySubtext}>Create your first estimate to get started</Text>
            </View>
          ) : (
            recentEstimates.map((estimate) => (
              <TouchableOpacity
                key={estimate.id}
                style={styles.estimateCard}
                onPress={() => router.push(`/estimate/${estimate.id}`)}
              >
                <View style={styles.estimateHeader}>
                  <Text style={styles.estimateName}>{estimate.project_name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: estimate.status === 'sent' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                    <Text style={[styles.statusText, { color: estimate.status === 'sent' ? '#10b981' : '#f59e0b' }]}>
                      {estimate.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.estimateClient}>{estimate.client_name}</Text>
                <View style={styles.estimateFooter}>
                  <Text style={styles.estimateTotal}>${estimate.grand_total?.toLocaleString()}</Text>
                  <Text style={styles.estimateDate}>
                    {format(new Date(estimate.created_at), 'MMM d, yyyy')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
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
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#9ca3af',
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionBanner: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subscriptionText: {
    marginLeft: 12,
    flex: 1,
  },
  subscriptionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  upgradeBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeBtnText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    alignItems: 'center',
  },
  statCardPrimary: {
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  seeAll: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  estimateCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  estimateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estimateName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  estimateClient: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  estimateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  estimateTotal: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '600',
  },
  estimateDate: {
    color: '#6b7280',
    fontSize: 12,
  },
});
