import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { X, Check, Trash2, Fuel, Camera, RefreshCw } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { GarageMotorcycle } from './garageStorage';
import { promptBikePhotoPicker } from '../BikeImage';

const CATEGORIES = [
  'Adventure',
  'Sport',
  'Naked',
  'Cruiser',
  'Touring',
  'Scrambler',
  'Dual Sport',
];

export interface MotorcycleModalProps {
  visible: boolean;
  editingBike: GarageMotorcycle | null;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    category?: string;
    engineCc?: number | null;
    odometerKm?: number | null;
    purchaseDate?: string | null;
    photoUri?: string | null;
    isDefault: boolean;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onOpenFuelLogs?: () => void;
}

export const MotorcycleModal: React.FC<MotorcycleModalProps> = ({
  visible,
  editingBike,
  onClose,
  onSave,
  onDelete,
  onOpenFuelLogs,
}) => {
  const isEditing = !!editingBike;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [engineCc, setEngineCc] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editingBike) {
        setName(editingBike.name || '');
        setCategory(editingBike.category || '');
        setEngineCc(
          editingBike.engineCc != null && editingBike.engineCc > 0
            ? String(editingBike.engineCc)
            : ''
        );
        setOdometerKm(
          editingBike.odometerKm != null && editingBike.odometerKm >= 0
            ? String(editingBike.odometerKm)
            : ''
        );
        setPurchaseDate(editingBike.purchaseDate || '');
        setPhotoUri(editingBike.photo_uri ?? editingBike.imageUri ?? null);
        setIsDefault(editingBike.isDefault);
      } else {
        setName('');
        setCategory('');
        setEngineCc('');
        setOdometerKm('');
        setPurchaseDate('');
        setPhotoUri(null);
        setIsDefault(true);
      }
    }
  }, [visible, editingBike]);

  const handlePickPhoto = () => {
    promptBikePhotoPicker((uri) => {
      setPhotoUri(uri);
    });
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Motorcycle Name Required', 'Please enter your motorcycle make and model.');
      return;
    }

    const parsedCc = engineCc.trim() ? Number(engineCc.replace(/[^0-9]/g, '')) : null;
    const parsedOdo = odometerKm.trim()
      ? Number(odometerKm.replace(/[^0-9.]/g, ''))
      : null;

    setSaving(true);
    try {
      await onSave({
        id: editingBike?.id,
        name: trimmedName,
        category: category.trim() || undefined,
        engineCc: parsedCc && Number.isFinite(parsedCc) && parsedCc > 0 ? parsedCc : null,
        odometerKm:
          parsedOdo !== null && Number.isFinite(parsedOdo) && parsedOdo >= 0
            ? parsedOdo
            : null,
        purchaseDate: purchaseDate.trim() || null,
        photoUri,
        isDefault,
      });
      onClose();
    } catch (err) {
      Alert.alert('Error', 'Could not save motorcycle details.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!editingBike || !onDelete) return;
    Alert.alert(
      'Remove Motorcycle',
      `Remove "${editingBike.name}" from your garage? Recorded rides and fuel logs will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await onDelete(editingBike.id);
            onClose();
          },
        },
      ]
    );
  };

  const hasPhoto = !!(photoUri && photoUri.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {isEditing ? 'Motorcycle Details' : 'Add Motorcycle'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {isEditing
                    ? 'Update your machine photo and specifications'
                    : 'Register a motorcycle to your garage'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
                hitSlop={8}
                style={styles.closeBtn}
              >
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
              {/* 16:10 Photo Tile */}
              <Text style={styles.fieldLabel}>MOTORCYCLE PHOTO (16:10)</Text>
              {hasPhoto ? (
                <View style={styles.photoPreviewBox}>
                  <Image
                    source={{ uri: photoUri! }}
                    style={styles.photoPreviewImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoOverlayActions}>
                    <Pressable
                      onPress={handlePickPhoto}
                      accessibilityRole="button"
                      accessibilityLabel="Change photo"
                      style={({ pressed }) => [
                        styles.photoActionPill,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <RefreshCw size={12} color={Colors.text} />
                      <Text style={styles.photoActionText}>Change</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleRemovePhoto}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      style={({ pressed }) => [
                        styles.photoActionPill,
                        styles.photoRemovePill,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Trash2 size={12} color={Colors.danger} />
                      <Text style={[styles.photoActionText, { color: Colors.danger }]}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Add photo"
                  style={({ pressed }) => [
                    styles.photoDashedBox,
                    pressed && { opacity: 0.78 },
                  ]}
                >
                  <View style={styles.cameraCircle}>
                    <Camera size={22} color={Colors.primary} strokeWidth={1.9} />
                  </View>
                  <Text style={styles.addPhotoTitle}>Add photo</Text>
                  <Text style={styles.addPhotoSub}>
                    Take photo or choose from gallery · 16:10 crop
                  </Text>
                </Pressable>
              )}

              <Text style={styles.fieldLabel}>MODEL NAME *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Royal Enfield Himalayan 450"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={50}
              />

              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {CATEGORIES.map((item) => {
                  const active = category.toLowerCase() === item.toLowerCase();
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(active ? '' : item)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ENGINE (CC)</Text>
                  <TextInput
                    style={styles.input}
                    value={engineCc}
                    onChangeText={setEngineCc}
                    placeholder="e.g. 452"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ODOMETER (KM)</Text>
                  <TextInput
                    style={styles.input}
                    value={odometerKm}
                    onChangeText={setOdometerKm}
                    placeholder="e.g. 4200"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={9}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>PURCHASE DATE</Text>
              <TextInput
                style={styles.input}
                value={purchaseDate}
                onChangeText={setPurchaseDate}
                placeholder="e.g. Mar 2024"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                maxLength={20}
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Default Motorcycle</Text>
                  <Text style={styles.switchSubtitle}>
                    Featured in your Garage hero and Home shortcut
                  </Text>
                </View>
                <Switch
                  value={isDefault}
                  onValueChange={setIsDefault}
                  trackColor={{ false: Colors.surfaceBorder, true: Colors.primaryDark }}
                  thumbColor={isDefault ? Colors.primary : Colors.textSecondary}
                />
              </View>

              {isEditing && onOpenFuelLogs ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenFuelLogs();
                  }}
                  style={({ pressed }) => [
                    styles.fuelShortcut,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Fuel size={16} color={Colors.primary} />
                  <Text style={styles.fuelShortcutText}>Open Fuel Economy Logs</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? 'Save changes' : 'Add motorcycle'}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (!name.trim() || saving) && styles.saveBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Check size={17} color="#06140D" strokeWidth={2.6} />
                <Text style={styles.saveBtnText}>
                  {saving
                    ? 'Saving...'
                    : isEditing
                      ? 'Save Changes'
                      : 'Add to Garage'}
                </Text>
              </Pressable>

              {isEditing && onDelete ? (
                <Pressable
                  onPress={handleConfirmDelete}
                  accessibilityRole="button"
                  accessibilityLabel="Remove motorcycle"
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Trash2 size={15} color={Colors.danger} />
                  <Text style={styles.deleteBtnText}>Remove from Garage</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 6, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
    maxHeight: '90%',
  },
  sheet: {
    backgroundColor: '#0E1411',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.15)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    paddingBottom: 16,
  },
  photoDashedBox: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(99, 230, 164, 0.38)',
    backgroundColor: 'rgba(18, 36, 28, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cameraCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 230, 164, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addPhotoTitle: {
    color: Colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  addPhotoSub: {
    color: Colors.textMuted,
    fontSize: 11.5,
    marginTop: 3,
  },
  photoPreviewBox: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111815',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.32)',
    position: 'relative',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlayActions: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  photoActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 18, 15, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.18)',
  },
  photoRemovePill: {
    borderColor: 'rgba(255, 119, 119, 0.35)',
  },
  photoActionText: {
    color: Colors.text,
    fontSize: 11.5,
    fontWeight: '600',
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#151D19',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.13)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14.5,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#151D19',
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.12)',
  },
  chipActive: {
    backgroundColor: 'rgba(18, 60, 40, 0.85)',
    borderColor: 'rgba(99, 230, 164, 0.48)',
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#131A17',
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.10)',
  },
  switchTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  switchSubtitle: {
    color: Colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  fuelShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(18, 52, 36, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.25)',
  },
  fuelShortcutText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: '#06140D',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    marginTop: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
