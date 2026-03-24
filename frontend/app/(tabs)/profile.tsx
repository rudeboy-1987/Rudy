import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { subscriptionApi } from '../../src/services/api';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleUploadLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploading(true);
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await updateProfile({ logo: base64Image });
        Alert.alert('Success', 'Logo updated successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    try {
      const price = tier === 'basic' ? '$4.99/month' : '$19.99/month';
      Alert.alert(
        `Upgrade to ${tier}`,
        `This would charge ${price} to your payment method. [MOCKED]`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              const response = await subscriptionApi.upgrade(tier);
              Alert.alert('Success', response.data.message);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to upgrade subscription');
    }
  };

  const getTierBadge = () => {
    switch (user?.subscription_tier) {
      case 'premium':
        return { label: 'Premium', color: '#f59e0b', icon: 'star' };
      case 'basic':
        return { label: 'Basic', color: '#10b981', icon: 'checkmark-circle' };
      default:
        return { label: 'Free Trial', color: '#3b82f6', icon: 'gift' };
    }
  };

  const tier = getTierBadge();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.logoContainer} onPress={handleUploadLogo}>
            {uploading ? (
              <ActivityIndicator size="large" color="#f59e0b" />
            ) : user?.logo ? (
              <Image source={{ uri: user.logo }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business" size={40} color="#6b7280" />
                <Text style={styles.uploadText}>Upload Logo</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.companyName}>{user?.company_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          <View style={[styles.tierBadge, { backgroundColor: `${tier.color}20` }]}>
            <Ionicons name={tier.icon as any} size={16} color={tier.color} />
            <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
          </View>

          {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="person-outline" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.menuItemText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/materials')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="pricetags-outline" size={20} color="#10b981" />
              </View>
              <Text style={styles.menuItemText}>Material Prices</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Subscription Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Subscription</Text>

          <View style={styles.subscriptionCard}>
            <Text style={styles.subscriptionTitle}>Current Plan: {tier.label}</Text>
            {user?.subscription_tier === 'free_trial' && (
              <Text style={styles.subscriptionSubtitle}>
                Trial ends: {user.trial_end ? new Date(user.trial_end).toLocaleDateString() : 'N/A'}
              </Text>
            )}

            <View style={styles.planOptions}>
              <TouchableOpacity
                style={[
                  styles.planCard,
                  user?.subscription_tier === 'basic' && styles.planCardActive,
                ]}
                onPress={() => handleUpgrade('basic')}
                disabled={user?.subscription_tier === 'basic' || user?.subscription_tier === 'premium'}
              >
                <Text style={styles.planPrice}>$4.99</Text>
                <Text style={styles.planPeriod}>/month</Text>
                <Text style={styles.planName}>Basic</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.planFeature}>Unlimited estimates</Text>
                  <Text style={styles.planFeature}>Email estimates</Text>
                  <Text style={styles.planFeature}>AI assistance</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.planCard,
                  styles.planCardPremium,
                  user?.subscription_tier === 'premium' && styles.planCardActive,
                ]}
                onPress={() => handleUpgrade('premium')}
                disabled={user?.subscription_tier === 'premium'}
              >
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>POPULAR</Text>
                </View>
                <Text style={styles.planPrice}>$19.99</Text>
                <Text style={styles.planPeriod}>/month</Text>
                <Text style={styles.planName}>Premium</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.planFeature}>All Basic features</Text>
                  <Text style={styles.planFeature}>Job board access</Text>
                  <Text style={styles.planFeature}>Priority support</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileCard: {
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 4,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#f59e0b',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  email: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  bio: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    color: '#ffffff',
    fontSize: 16,
  },
  subscriptionCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
  },
  subscriptionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  subscriptionSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  planOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  planCardPremium: {
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  planCardActive: {
    opacity: 0.5,
  },
  popularBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  popularText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planPrice: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  planPeriod: {
    color: '#9ca3af',
    fontSize: 12,
  },
  planName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  planFeatures: {
    marginTop: 12,
    alignItems: 'center',
  },
  planFeature: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  version: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
});
