// app/src/screens/SettingsScreen.tsx
// Settings screen for API URL and theme configuration

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemeManager } from '../hooks/useTheme';
import { preferencesStorage } from '../services/storage/PreferencesStorage';
import { updateApiBaseUrl } from '../services/api/MusicApi';
import { updateSocketManagerUrl } from '../services/sync/SocketManager';
import { toast } from '../components/common/Toast';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const themeColors = useTheme(); // useTheme returns Theme object with colors, spacing, etc.
  const { theme, setTheme, themeColors: effectiveTheme } = useThemeManager();
  
  const [apiUrl, setApiUrl] = useState('http://localhost:3000');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedUrl = await preferencesStorage.getApiUrl();
      if (savedUrl) {
        setApiUrl(savedUrl);
      }
    } catch (error) {
      console.error('[SettingsScreen] Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate API URL
    if (!apiUrl.trim()) {
      toast.error('请输入 API 地址');
      return;
    }

    // Validate URL format
    try {
      const url = new URL(apiUrl);
      if (!url.protocol.startsWith('http')) {
        toast.error('API 地址必须以 http:// 或 https:// 开头');
        return;
      }
    } catch (error) {
      toast.error('API 地址格式无效');
      return;
    }

    setIsSaving(true);
    try {
      await preferencesStorage.setApiUrl(apiUrl.trim());
      
      // Update the API URL and Socket URL immediately without needing restart
      updateApiBaseUrl(apiUrl.trim());
      updateSocketManagerUrl(apiUrl.trim());
      
      toast.success('设置已保存并生效');
    } catch (error) {
      console.error('[SettingsScreen] Failed to save settings:', error);
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      '重置设置',
      '确定要重置所有设置到默认值吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置',
          style: 'destructive',
          onPress: async () => {
            try {
              await preferencesStorage.clear();
              setApiUrl('http://localhost:3000');
              setTheme('auto');
              toast.success('设置已重置');
            } catch (error) {
              console.error('[SettingsScreen] Failed to reset settings:', error);
              toast.error('重置失败');
            }
          },
        },
      ]
    );
  };

  const handleTestConnection = async () => {
    try {
      const url = apiUrl.trim();
      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`连接成功 (v${data.version || '1.0.0'})`);
      } else {
        toast.error(`连接失败 (${response.status})`);
      }
    } catch (error: unknown) {
      console.error('[SettingsScreen] Connection test failed:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('连接超时');
      } else {
        toast.error('无法连接到服务器');
      }
    }
  };

  const themeOptions = [
    { value: 'auto' as const, label: '跟随系统' },
    { value: 'light' as const, label: '浅色模式' },
    { value: 'dark' as const, label: '深色模式' },
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: effectiveTheme.colors.background }]}>
        <Text style={[styles.loadingText, { color: effectiveTheme.colors.text }]}>
          加载中...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: effectiveTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: effectiveTheme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: effectiveTheme.colors.primary }]}>
            ← 返回
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: effectiveTheme.colors.text }]}>设置</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* API Configuration */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: effectiveTheme.colors.text }]}>
            后端 API 配置
          </Text>
          
          <Text style={[styles.label, { color: effectiveTheme.colors.textSecondary }]}>
            API 地址
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: effectiveTheme.colors.surface,
                color: effectiveTheme.colors.text,
                borderColor: effectiveTheme.colors.border,
              },
            ]}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://localhost:3000"
            placeholderTextColor={effectiveTheme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={[styles.hint, { color: effectiveTheme.colors.textSecondary }]}>
            示例: http://192.168.1.100:3000
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonSecondary,
                { borderColor: effectiveTheme.colors.primary },
              ]}
              onPress={handleTestConnection}
            >
              <Text style={[styles.buttonText, { color: effectiveTheme.colors.primary }]}>
                测试连接
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: effectiveTheme.colors.primary }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                {isSaving ? '保存中...' : '保存'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme Configuration */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: effectiveTheme.colors.text }]}>
            主题设置
          </Text>

          {themeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.themeOption,
                {
                  backgroundColor:
                    theme === option.value
                      ? effectiveTheme.colors.primary + '20'
                      : effectiveTheme.colors.surface,
                  borderColor:
                    theme === option.value
                      ? effectiveTheme.colors.primary
                      : effectiveTheme.colors.border,
                },
              ]}
              onPress={() => setTheme(option.value)}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color:
                      theme === option.value
                        ? effectiveTheme.colors.primary
                        : effectiveTheme.colors.text,
                  },
                ]}
              >
                {option.label}
              </Text>
              {theme === option.value && (
                <Text style={[styles.checkmark, { color: effectiveTheme.colors.primary }]}>
                  ✓
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: effectiveTheme.colors.text }]}>
            应用信息
          </Text>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: effectiveTheme.colors.textSecondary }]}>
              版本
            </Text>
            <Text style={[styles.infoValue, { color: effectiveTheme.colors.text }]}>
              1.0.0
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: effectiveTheme.colors.textSecondary }]}>
              平台
            </Text>
            <Text style={[styles.infoValue, { color: effectiveTheme.colors.text }]}>
              {Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iOS' : 'Android'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: effectiveTheme.colors.textSecondary }]}>
              当前主题
            </Text>
            <Text style={[styles.infoValue, { color: effectiveTheme.colors.text }]}>
              {effectiveTheme.name === 'light' ? '浅色' : '深色'}
            </Text>
          </View>
        </View>

        {/* Reset Button */}
        <TouchableOpacity
          style={[styles.resetButton, { borderColor: effectiveTheme.colors.error }]}
          onPress={handleReset}
        >
          <Text style={[styles.resetButtonText, { color: effectiveTheme.colors.error }]}>
            重置所有设置
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    width: 80,
  },
  backButtonText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 80,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  themeOptionText: {
    fontSize: 16,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
