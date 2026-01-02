import { ConfigPlugin, withAndroidManifest } from '@expo/config-plugins';

const withAndroidPlugin: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults.manifest.application[0]['$']['tools:replace'] = 'android:appComponentFactory';
    config.modResults.manifest.application[0]['$']['android:appComponentFactory'] =
      'androidx.core.app.CoreComponentFactory';
    return config;
  });
};

export default withAndroidPlugin;
