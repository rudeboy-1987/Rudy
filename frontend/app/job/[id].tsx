import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { jobsApi, Job } from '../../src/services/api';
import { format } from 'date-fns';

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJob = useCallback(async () => {
    if (!id) return;
    try {
      const response = await jobsApi.getOne(id);
      setJob(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load job');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleContact = (method: 'email' | 'phone') => {
    if (!job) return;

    if (method === 'email' && job.poster_email) {
      Linking.openURL(`mailto:${job.poster_email}?subject=Re: ${job.title}`);
    } else if (method === 'phone' && job.poster_phone) {
      Linking.openURL(`tel:${job.poster_phone}`);
    }
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

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Job not found</Text>
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
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  job.status === 'open' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              },
            ]}
          >
            <Ionicons
              name={job.status === 'open' ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={job.status === 'open' ? '#10b981' : '#6b7280'}
            />
            <Text
              style={[
                styles.statusText,
                { color: job.status === 'open' ? '#10b981' : '#6b7280' },
              ]}
            >
              {job.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.dateText}>
            Posted {format(new Date(job.created_at), 'MMM d, yyyy')}
          </Text>
        </View>

        {/* Job Title */}
        <Text style={styles.jobTitle}>{job.title}</Text>

        {/* Project Type Badge */}
        <View style={styles.typeBadge}>
          <Ionicons
            name={job.project_type === 'residential' ? 'home' : 'business'}
            size={14}
            color="#f59e0b"
          />
          <Text style={styles.typeText}>{job.project_type}</Text>
        </View>

        {/* Poster Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={24} color="#3b82f6" />
            <Text style={styles.cardTitle}>Posted By</Text>
          </View>
          <View style={styles.posterInfo}>
            <View style={styles.posterIcon}>
              <Ionicons
                name={job.poster_type === 'homeowner' ? 'home' : 'business'}
                size={28}
                color="#3b82f6"
              />
            </View>
            <View style={styles.posterDetails}>
              <Text style={styles.posterName}>{job.poster_name}</Text>
              <Text style={styles.posterType}>
                {job.poster_type === 'homeowner' ? 'Homeowner' : 'Business'}
              </Text>
            </View>
          </View>
        </View>

        {/* Job Description */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color="#f59e0b" />
            <Text style={styles.cardTitle}>Description</Text>
          </View>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={24} color="#10b981" />
            <Text style={styles.cardTitle}>Details</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="location" size={20} color="#6b7280" />
            </View>
            <View>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{job.location}</Text>
            </View>
          </View>

          {job.budget_range && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="cash" size={20} color="#6b7280" />
              </View>
              <View>
                <Text style={styles.detailLabel}>Budget</Text>
                <Text style={styles.detailValue}>{job.budget_range}</Text>
              </View>
            </View>
          )}

          {job.timeline && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time" size={20} color="#6b7280" />
              </View>
              <View>
                <Text style={styles.detailLabel}>Timeline</Text>
                <Text style={styles.detailValue}>{job.timeline}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Images */}
        {job.images && job.images.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images" size={24} color="#8b5cf6" />
              <Text style={styles.cardTitle}>Photos</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.imagesRow}>
                {job.images.map((image, index) => (
                  <Image key={index} source={{ uri: image }} style={styles.jobImage} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Contact Buttons */}
      <View style={styles.footer}>
        {job.poster_phone && (
          <TouchableOpacity
            style={[styles.contactButton, styles.phoneButton]}
            onPress={() => handleContact('phone')}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.phoneButtonText}>Call</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.contactButton, styles.emailButton]}
          onPress={() => handleContact('email')}
        >
          <Ionicons name="mail" size={20} color="#000" />
          <Text style={styles.emailButtonText}>Email</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
  },
  statusRow: {
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
  jobTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
    gap: 6,
  },
  typeText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
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
  posterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  posterIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterDetails: {
    marginLeft: 12,
  },
  posterName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  posterType: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 2,
  },
  description: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailLabel: {
    color: '#6b7280',
    fontSize: 12,
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  jobImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  phoneButton: {
    backgroundColor: '#3b82f6',
  },
  phoneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emailButton: {
    backgroundColor: '#f59e0b',
  },
  emailButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
