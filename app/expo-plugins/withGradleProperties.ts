import { ConfigPlugin, withGradleProperties } from '@expo/config-plugins';

const withGradlePlugin: ConfigPlugin = (config) => {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults;

    // Enable AndroidX
    if (!properties.find((p) => p.key === 'android.useAndroidX')) {
      properties.push({ type: 'property', key: 'android.useAndroidX', value: 'true' });
    }

    // Enable Jetifier
    if (!properties.find((p) => p.key === 'android.enableJetifier')) {
      properties.push({ type: 'property', key: 'android.enableJetifier', value: 'true' });
    }

    return config;
  });
};

export default withGradlePlugin;
