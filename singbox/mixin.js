const onGenerate = async (config) => {
  const outbounds = config.outbounds ?? [];
  const ruleSetDownloadDetourTag = "🇨🇳 大陆直连";

  // 剔除组内悬空引用;清空后的组本身也删除,连锁清理上层组
  let removedInPass;
  do {
    const tagSet = new Set(outbounds.map((o) => o.tag));
    removedInPass = 0;

    for (let i = outbounds.length - 1; i >= 0; i--) {
      const o = outbounds[i];
      if (!Array.isArray(o.outbounds)) continue;

      o.outbounds = o.outbounds.filter((ref) => tagSet.has(ref));

      if (o.outbounds.length === 0) {
        outbounds.splice(i, 1);
        removedInPass++;
      }
    }
  } while (removedInPass > 0);

  config.outbounds = outbounds;

  const finalTagSet = new Set(outbounds.map((o) => o.tag));

  // 让所有远程规则集通过“🇨🇳 大陆直连”下载。
  const ruleSets = config.route?.rule_set;
  const remoteRuleSets = Array.isArray(ruleSets)
    ? ruleSets.filter((ruleSet) => ruleSet?.type === "remote")
    : [];

  if (remoteRuleSets.length > 0) {
    if (!finalTagSet.has(ruleSetDownloadDetourTag)) {
      throw new Error(
        `无法设置规则集下载出口：出站「${ruleSetDownloadDetourTag}」不存在。`,
      );
    }

    for (const ruleSet of remoteRuleSets) {
      ruleSet.download_detour = ruleSetDownloadDetourTag;
    }
  }

  // 清理已删除出站对应的路由规则
  if (config.route?.rules) {
    config.route.rules = config.route.rules.filter(
      (rule) => !rule.outbound || finalTagSet.has(rule.outbound),
    );
  }
  if (config.route?.final && !finalTagSet.has(config.route.final)) {
    delete config.route.final;
  }

  return config;
};
