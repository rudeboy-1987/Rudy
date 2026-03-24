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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { jobsApi } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

export default function CreateJobScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [posterType, setPosterType] = useState<'homeowner' | 'business'>('homeowner');
  const [posterName, setPosterName] = useState('');
  const [posterEmail, setPosterEmail] = useState('');
  const [posterPhone, setPosterPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<'residential' | 'commercial'>('residential');
  const [location, setLocation] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [timeline, setTimeline] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 images allowed');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setImages([...images, base64Image]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!posterName || !posterEmail || !title || !description || !location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const jobData = {
        poster_type: posterType,
        poster_name: posterName,
        poster_email: posterEmail,
        poster_phone: posterPhone || undefined,
        title,
        description,
        project_type: projectType,
        location,
        budget_range: budgetRange || undefined,
        timeline: timeline || undefined,
        images,
      };

      await jobsApi.create(jobData);
      Alert.alert('Success', 'Job posted successfully!', [
        { text: 'View Jobs', onPress: () => router.replace('/(tabs)/jobs') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.title}>Post a Job</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Poster Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>I am a</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, posterType === 'homeowner' && styles.toggleActive]}
                onPress={() => setPosterType('homeowner')}
              >
                <Ionicons
                  name="home"
                  size={20}
                  color={posterType === 'homeowner' ? '#000' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.toggleText,
                    posterType === 'homeowner' && styles.toggleTextActive,
                  ]}
                >
                  Homeowner
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, posterType === 'business' && styles.toggleActive]}
                onPress={() => setPosterType('business')}
              >
                <Ionicons
                  name="business"
                  size={20}
                  color={posterType === 'business' ? '#000' : '#9ca3af'}
                />
                <Text
                  style={[styles.toggleText, posterType === 'business' && styles.toggleTextActive]}
                >
                  Business
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contact Info */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#6b7280"
              value={posterName}
              onChangeText={setPosterName}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor="#6b7280"
                value={posterEmail}
                onChangeText={setPosterEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor="#6b7280"
                value={posterPhone}
                onChangeText={setPosterPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Job Details */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Job Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Need electrician for kitchen rewiring"
              placeholderTextColor="#6b7280"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the electrical work you need done in detail..."
              placeholderTextColor="#6b7280"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
            />
          </View>

          {/* Project Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Project Type</Text>
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
                  style={[
                    styles.toggleText,
                    projectType === 'residential' && styles.toggleTextActive,
                  ]}
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
                  style={[
                    styles.toggleText,
                    projectType === 'commercial' && styles.toggleTextActive,
                  ]}
                >
                  Commercial
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              placeholder="City, State or ZIP code"
              placeholderTextColor="#6b7280"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Budget Range</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., $500-$1,000"
                placeholderTextColor="#6b7280"
                value={budgetRange}
                onChangeText={setBudgetRange}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Timeline</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Within 2 weeks"
                placeholderTextColor="#6b7280"
                value={timeline}
                onChangeText={setTimeline}
              />
            </View>
          </View>

          {/* Images */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photos (optional, max 5)</Text>
            <View style={styles.imagesGrid}>
              {images.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri: image }} style={styles.thumbnail} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                  <Ionicons name="camera-outline" size={24} color="#6b7280" />
                  <Text style={styles.addImageText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="megaphone" size={20} color="#000" />
                <Text style={styles.submitButtonText}>Post Job</Text>
              </>
            )}
          </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 20,
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
    minHeight: 120,
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
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 18,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
  },
});
