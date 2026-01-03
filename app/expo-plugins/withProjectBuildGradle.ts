import { ConfigPlugin, withProjectBuildGradle } from '@expo/config-plugins';

/**
 * 在 repositories 块中添加镜像源
 * @param contents build.gradle 文件内容
 * @param repoLines 要添加的仓库配置行
 * @returns 修改后的文件内容
 */
const ensureRepoInRepositories = (contents: string, repoLines: string): string => {
  // 检查是否已存在阿里云镜像标记
  if (contents.includes('// 阿里云镜像')) {
    return contents;
  }

  let modified = contents;
  let inserted = false;

  // 优先在 buildscript.repositories 中插入
  const buildscriptPattern = /(buildscript\s*\{[\s\S]*?repositories\s*\{)/;
  if (buildscriptPattern.test(modified)) {
    modified = modified.replace(buildscriptPattern, (match) => {
      inserted = true;
      return `${match}\n        ${repoLines}`;
    });
  }

  // 同时在 allprojects.repositories 中插入
  const allprojectsPattern = /(allprojects\s*\{[\s\S]*?repositories\s*\{)/;
  if (allprojectsPattern.test(modified)) {
    modified = modified.replace(allprojectsPattern, (match) => {
      // 避免在同一个 repositories 块中重复插入
      if (!inserted || !match.includes('buildscript')) {
        return `${match}\n        ${repoLines}`;
      }
      return match;
    });
  }

  // 如果都没找到，在文件顶部插入警告注释
  if (!inserted) {
    console.warn('⚠️ 未找到 repositories 块，镜像源可能未正确插入');
  }

  return modified;
};

/**
 * Expo Config Plugin: 为项目级 build.gradle 添加国内镜像源
 * 提高依赖下载速度
 */
const withProjectBuildGradlePlugin: ConfigPlugin = (config) => {
  return withProjectBuildGradle(config, (modConfig) => {
    const projectBuildGradle = modConfig.modResults;

    // 定义要添加的镜像源配置
    const repoLines = `
    maven { url 'https://maven.aliyun.com/repository/public' }
    maven { url 'https://maven.aliyun.com/repository/google' }
    maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
    maven { url 'https://maven.aliyun.com/repository/central' }
    maven { url 'https://repo.huaweicloud.com/repository/maven/' }
    maven { url 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/' }
    `;

    // 应用修改
    projectBuildGradle.contents = ensureRepoInRepositories(
      projectBuildGradle.contents,
      repoLines
    );

    return modConfig;
  });
};

export default withProjectBuildGradlePlugin;