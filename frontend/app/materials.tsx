import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { materialsApi, MaterialPrice } from '../src/services/api';
import { formatDistanceToNow } from 'date-fns';

export default function MaterialsScreen() {
  const router = useRouter();
  const [materials, setMaterials] = useState<MaterialPrice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Edit modal state
  const [editing, setEditing] = useState<MaterialPrice | null>(null);
  const [creating, setCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCategory, setEditCategory] = useState('wire');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const categories = [
    { id: 'all', label: 'All', icon: 'grid' },
    { id: 'wire', label: 'Wire', icon: 'git-branch' },
    { id: 'conduit', label: 'Conduit', icon: 'analytics' },
    { id: 'boxes', label: 'Boxes', icon: 'cube' },
    { id: 'devices', label: 'Devices', icon: 'toggle' },
    { id: 'panels', label: 'Panels', icon: 'server' },
    { id: 'lighting', label: 'Lighting', icon: 'bulb' },
    { id: 'specialty', label: 'Specialty', icon: 'star' },
  ];

  const editableCategories = categories.filter((c) => c.id !== 'all');

  const loadMaterials = async () => {
    try {
      const response = await materialsApi.getPrices();
      if (!response.data || response.data.length === 0) {
        await materialsApi.seedPrices();
        const seeded = await materialsApi.getPrices();
        setMaterials(seeded.data);
      } else {
        setMaterials(response.data);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const filteredMaterials = materials.filter((m) => {
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadMaterials();
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.id === category);
    return cat?.icon || 'pricetag';
  };

  const openEdit = (m: MaterialPrice) => {
    setCreating(false);
    setEditing(m);
    setEditName(m.name);
    setEditPrice(String(m.price));
    setEditUnit(m.unit);
    setEditCategory(m.category);
    setEditDescription(m.description || '');
  };

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setEditName('');
    setEditPrice('');
    setEditUnit('each');
    setEditCategory(selectedCategory === 'all' ? 'wire' : selectedCategory);
    setEditDescription('');
  };

  const closeModal = () => {
    setEditing(null);
    setCreating(false);
  };

  const saveEdit = async () => {
    const price = parseFloat(editPrice.replace(/[^0-9.]/g, ''));
    if (!editName.trim()) return Alert.alert('Name required', 'Please enter a material name');
    if (isNaN(price) || price < 0) return Alert.alert('Invalid price', 'Please enter a valid price');
    if (!editUnit.trim()) return Alert.alert('Unit required', 'e.g. each, ft, roll');

    setSaving(true);
    try {
      if (creating) {
        await materialsApi.createPrice({
          name: editName.trim(),
          price,
          unit: editUnit.trim(),
          category: editCategory,
          description: editDescription.trim() || undefined,
        });
      } else if (editing) {
        await materialsApi.updatePrice(editing.id, {
          name: editName.trim(),
          price,
          unit: editUnit.trim(),
          category: editCategory,
          description: editDescription.trim() || undefined,
        });
      }
      await loadMaterials();
      closeModal();
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.detail || e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const removeMaterial = (m: MaterialPrice) => {
    Alert.alert(
      'Delete material',
      `Remove "${m.name}" from your price database?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await materialsApi.deletePrice(m.id);
              setMaterials((prev) => prev.filter((x) => x.id !== m.id));
            } catch (e: any) {
              Alert.alert('Failed', e?.response?.data?.detail || 'Try again');
            }
          },
        },
      ]
    );
  };

  const renderMaterial = ({ item }: { item: MaterialPrice }) => {
    let updatedLabel = 'never';
    if (item.last_updated) {
      try {
        updatedLabel = formatDistanceToNow(new Date(item.last_updated), { addSuffix: true });
      } catch {
        updatedLabel = 'recently';
      }
    }
    const isFresh =
      item.last_updated && Date.now() - new Date(item.last_updated).getTime() < 60_000;

    return (
      <TouchableOpacity style={styles.materialCard} onPress={() => openEdit(item)} onLongPress={() => removeMaterial(item)} activeOpacity={0.85}>
        <View style={styles.materialIcon}>
          <Ionicons name={getCategoryIcon(item.category) as any} size={24} color="#00ff66" />
        </View>
        <View style={styles.materialInfo}>
          <Text style={styles.materialName} numberOfLines={1}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.materialDescription} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.materialMeta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <Text style={styles.unitText}>per {item.unit}</Text>
            <View style={styles.updatedRow}>
              <Ionicons name="time-outline" size={11} color={isFresh ? '#00ff66' : '#6b7280'} />
              <Text style={[styles.updatedText, isFresh && { color: '#00ff66', fontWeight: '700' }]}>
                {updatedLabel}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.priceValue}>${item.price.toFixed(2)}</Text>
          <Ionicons name="create-outline" size={14} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Material Prices</Text>
        <TouchableOpacity onPress={openCreate} style={styles.iconBtn}>
          <Ionicons name="add-circle" size={26} color="#00ff66" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="pricetag" size={18} color="#00ff66" />
        <Text style={styles.infoBannerText}>
          Tap any item to update its price. Long-press to delete. Tap + to add a new item.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search materials..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === item.id && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(item.id)}
          >
            <Ionicons name={item.icon as any} size={16} color={selectedCategory === item.id ? '#000' : '#9ca3af'} />
            <Text style={[styles.categoryChipText, selectedCategory === item.id && styles.categoryChipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#00ff66" />
        </View>
      ) : (
        <FlatList
          data={filteredMaterials}
          keyExtractor={(item) => item.id}
          renderItem={renderMaterial}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00ff66" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="pricetags-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyTitle}>No materials found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search term' : 'Materials database is empty'}
              </Text>
              <TouchableOpacity style={styles.addBtnEmpty} onPress={openCreate}>
                <Ionicons name="add" size={16} color="#000" />
                <Text style={styles.addBtnText}>Add first material</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Edit / Create Modal */}
      <Modal visible={!!editing || creating} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{creating ? 'Add material' : 'Update price'}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.iconBtn}>
                <Ionicons name="close" size={26} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 12/2 NM-B Wire (250ft)"
              placeholderTextColor="#6b7280"
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={styles.label}>Price (USD)</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Unit</Text>
            <View style={styles.chipRow}>
              {['each', 'ft', 'roll', 'box', 'piece', 'spool'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.smallChip, editUnit === u && styles.smallChipActive]}
                  onPress={() => setEditUnit(u)}
                >
                  <Text style={[styles.smallChipText, editUnit === u && styles.smallChipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {editableCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.smallChip, editCategory === c.id && styles.smallChipActive]}
                  onPress={() => setEditCategory(c.id)}
                >
                  <Text style={[styles.smallChipText, editCategory === c.id && styles.smallChipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              placeholder="Notes about this material"
              placeholderTextColor="#6b7280"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
            />

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveEdit} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" /> : (
                <>
                  <Ionicons name="checkmark" size={18} color="#000" />
                  <Text style={styles.saveBtnText}>{creating ? 'Add material' : 'Save changes'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,255,102,0.08)',
    marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, gap: 8,
    borderWidth: 1, borderColor: 'rgba(0,255,102,0.3)',
  },
  infoBannerText: { color: '#9ca3af', fontSize: 12, flex: 1 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: 12,
    marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 8 },
  categoryContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 6 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#1f2937', marginRight: 6,
  },
  categoryChipActive: { backgroundColor: '#00ff66' },
  categoryChipText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#000' },
  listContent: { padding: 16, paddingTop: 6 },
  materialCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#374151',
  },
  materialIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,255,102,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  materialInfo: { flex: 1 },
  materialName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  materialDescription: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  materialMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  categoryBadge: { backgroundColor: '#374151', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  categoryText: { color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  unitText: { color: '#6b7280', fontSize: 11 },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  updatedText: { color: '#6b7280', fontSize: 10 },
  priceContainer: { alignItems: 'flex-end', marginLeft: 8 },
  priceValue: { color: '#00ff66', fontSize: 18, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtitle: { color: '#9ca3af', fontSize: 13, marginTop: 6, textAlign: 'center' },
  addBtnEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00ff66', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, marginTop: 16,
  },
  addBtnText: { color: '#000', fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 30, maxHeight: '92%',
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#374151', marginBottom: 10,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  label: { color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1f2937', color: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15, borderWidth: 1, borderColor: '#374151',
  },
  priceInput: { fontSize: 22, fontWeight: '800', color: '#00ff66' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151' },
  smallChipActive: { backgroundColor: '#00ff66', borderColor: '#00ff66' },
  smallChipText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  smallChipTextActive: { color: '#000' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ff66', paddingVertical: 14, borderRadius: 12, marginTop: 18,
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
