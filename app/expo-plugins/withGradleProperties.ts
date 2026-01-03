import { ConfigPlugin, withGradleProperties } from '@expo/config-plugins';
import { PropertiesItem } from '@expo/config-plugins/build/android/Properties.js';

function setProperty(properties: PropertiesItem[], key: string, value: string) {
  const property = properties.find((p) => p.key === key);
  if (property) {
    property.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

const withGradlePlugin: ConfigPlugin = (config) => {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults;

    // Enable AndroidX
    setProperty(properties, 'android.useAndroidX', 'true');

    // Enable Jetifier
    setProperty(properties, 'android.enableJetifier', 'true');

    // Enable Minify in Release Builds
    setProperty(properties, 'minifyEnabled', 'true');

    // Disable newArchEnabled
    setProperty(properties, 'newArchEnabled', 'false');

    // Enable Hermes
    setProperty(properties, 'hermesEnabled', 'true');

    // Enable android.enableR8.fullMode
    setProperty(properties, 'android.enableR8.fullMode', 'true');

    return config;
  });
};

export default withGradlePlugin;
