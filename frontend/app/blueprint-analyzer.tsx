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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { aiApi } from '../src/services/api';

export default function BlueprintAnalyzerScreen() {
  const router = useRouter();
  const [blueprintImage, setBlueprintImage] = useState<string | null>(null);
  const [projectDescription, setProjectDescription] = useState('');
  const [projectType, setProjectType] = useState<'residential' | 'commercial'>('residential');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setBlueprintImage(result.assets[0].base64 || null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setBlueprintImage(result.assets[0].base64 || null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const analyzeBlueprint = async () => {
    if (!projectDescription.trim()) {
      Alert.alert('Error', 'Please provide a project description');
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const response = await aiApi.analyzeBlueprint(
        blueprintImage,
        projectDescription,
        projectType
      );
      setAnalysis(response.data.analysis);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to analyze. Please try again.'
      );
    } finally {
      setAnalyzing(false);
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
          <Text style={styles.title}>Blueprint Analyzer</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* AI Badge */}
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={20} color="#f59e0b" />
            <Text style={styles.aiBadgeText}>AI-Powered Analysis</Text>
          </View>

          {/* Blueprint Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upload Blueprint (Optional)</Text>
            <Text style={styles.sectionSubtitle}>
              Upload a photo of your blueprint for more accurate analysis
            </Text>

            {blueprintImage ? (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${blueprintImage}` }}
                  style={styles.blueprintImage}
                />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setBlueprintImage(null)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadOptions}>
                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                  <Ionicons name="images-outline" size={32} color="#f59e0b" />
                  <Text style={styles.uploadButtonText}>Choose Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={32} color="#f59e0b" />
                  <Text style={styles.uploadButtonText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

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

          {/* Project Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Description *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the electrical work needed...\n\nExample: Complete rewiring of a 2,000 sq ft home, including 20 outlets, 15 light fixtures, new 200A panel, and EV charger installation in garage."
              placeholderTextColor="#6b7280"
              value={projectDescription}
              onChangeText={setProjectDescription}
              multiline
              numberOfLines={6}
            />
          </View>

          {/* Analyze Button */}
          <TouchableOpacity
            style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
            onPress={analyzeBlueprint}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <ActivityIndicator color="#000" />
                <Text style={styles.analyzeButtonText}>Analyzing...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={24} color="#000" />
                <Text style={styles.analyzeButtonText}>Generate Estimate</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Analysis Results */}
          {analysis && (
            <View style={styles.resultsSection}>
              <View style={styles.resultsHeader}>
                <Ionicons name="document-text" size={24} color="#f59e0b" />
                <Text style={styles.resultsTitle}>AI Analysis</Text>
              </View>
              <View style={styles.resultsCard}>
                <Text style={styles.resultsText}>{analysis}</Text>
              </View>
              <TouchableOpacity
                style={styles.createEstimateBtn}
                onPress={() => router.push('/create-estimate')}
              >
                <Text style={styles.createEstimateBtnText}>Create Estimate from Analysis</Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          )}
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
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 24,
    gap: 8,
  },
  aiBadgeText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 16,
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  blueprintImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  textArea: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  analyzeButtonDisabled: {
    opacity: 0.7,
  },
  analyzeButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
  },
  resultsSection: {
    marginTop: 32,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  resultsTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  resultsCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  resultsText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 22,
  },
  createEstimateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  createEstimateBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
