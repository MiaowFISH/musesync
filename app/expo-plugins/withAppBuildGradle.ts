import { ConfigPlugin, withAppBuildGradle } from '@expo/config-plugins';

/**
 * 确保 splits 块存在并配置正确
 * @param contents app/build.gradle 文件内容
 * @param splitsBlock 要添加的 splits 配置
 * @returns 修改后的文件内容
 */
const ensureSplitsBlock = (contents: string, splitsBlock: string): string => {
  // 检查是否已经存在 splits 块
  const splitsPattern = /splits\s*\{[\s\S]*?\n\s*\}/;
  
  if (splitsPattern.test(contents)) {
    // 如果存在，检查是否包含我们需要的 ABI 配置
    const existingSplits = contents.match(splitsPattern)?.[0] || '';
    
    // 如果已经包含正确的配置，不做修改
    if (existingSplits.includes("include 'armeabi-v7a', 'arm64-v8a'")) {
      return contents;
    }
    
    // 否则替换为新的配置
    return contents.replace(splitsPattern, splitsBlock);
  }

  // splits 块不存在，需要插入
  
  // 策略1: 在 androidResources 块之后插入（最精确）
  const androidResourcesPattern = /(androidResources\s*\{[^}]*\}\s*\n)(\})/;
  if (androidResourcesPattern.test(contents)) {
    return contents.replace(androidResourcesPattern, `$1    ${splitsBlock}\n$2`);
  }

  // 策略2: 在 packagingOptions 块之后、android 块闭合前插入
  const packagingPattern = /(packagingOptions\s*\{[\s\S]*?\}\s*\n)(\})/;
  if (packagingPattern.test(contents)) {
    return contents.replace(packagingPattern, `$1    ${splitsBlock}\n$2`);
  }

  // 策略3: 在 buildTypes 块之后插入
  const buildTypesPattern = /(buildTypes\s*\{[\s\S]*?\n\s*\}\s*\n)/;
  if (buildTypesPattern.test(contents)) {
    return contents.replace(buildTypesPattern, `$1    ${splitsBlock}\n\n`);
  }

  // 策略4: 在 android 块的闭合括号前插入（查找 android { ... } 并在最后的 } 前插入）
  // 使用更精确的匹配：找到 android 块，但排除 dependencies 块
  const androidClosePattern = /(android\s*\{[\s\S]*?)\n(\}\s*\n\s*\/\/ Apply static values)/;
  if (androidClosePattern.test(contents)) {
    return contents.replace(androidClosePattern, `$1\n    ${splitsBlock}\n$2`);
  }

  // 如果以上都失败，输出警告
  console.warn('⚠️ 未找到合适的插入位置，splits 配置可能未正确添加');
  return contents;
};

/**
 * Expo Config Plugin: 为 app/build.gradle 添加 ABI splits 配置
 * 用于生成特定架构的 APK，减小包体积
 */
const withAppBuildGradlePlugin: ConfigPlugin = (config) => {
  return withAppBuildGradle(config, (modConfig) => {
    const appBuildGradle = modConfig.modResults;

    // 定义 splits 配置块
    const splitsBlock = `splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a'
            universalApk false
        }
    }`;

    // 应用修改
    appBuildGradle.contents = ensureSplitsBlock(
      appBuildGradle.contents,
      splitsBlock
    );

    return modConfig;
  });
};

export default withAppBuildGradlePlugin;
