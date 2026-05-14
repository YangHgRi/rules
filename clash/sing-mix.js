// https://github.com/Sakyvo/sing-mix/blob/main/sing-mix_origin

// ====================
// 0. 特殊域名处理(手动添加)
// ====================

// 强制直连
const BYPASS_DOMAINS = ["example.com", "example.org"];

// 强制代理
const FORCE_PROXY_DOMAINS = ["test.com", "test.org"];

// ====================
// 1. 常量配置
// ====================
const SETTINGS = {
  ICON_BASE: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/",
  GEOIP_URL:
    "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat",
  GEOSITE_URL:
    "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat",

  REGION_ORDER: ["US", "KR", "JP", "SG", "HK", "TW"],

  URL_TEST_EXTRA: {
    hidden: true,
    url: "https://www.g.cn/generate_204",
    interval: 900,
    tolerance: 50,
    lazy: true,
    timeout: 1000,
  },

  BETTER_FB_EXTRA: {
    hidden: true,
    url: "https://www.g.cn/generate_204",
    interval: 900,
    tolerance: 750,
    lazy: true,
    timeout: 1000,
    "max-failed-times": 1,
  },

  FILTER_REGEX:
    /群|邀请|返利|官网|官方|网址|订阅|购买|续费|剩余|到期|过期|流量|备用|邮箱|客服|联系|工单|倒卖|防止|梯子|tg|telegram|电报|发布|重置|Traffic|Expire/i,

  LOW_RATE_REGEX: /0\.[0-5]|低倍率|省流|大流量|实验性/i,
};

// ====================
// 2. 基础工具
// ====================
const uniq = (arr = []) => [...new Set(arr.filter(Boolean))];

const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeName = (name = "") =>
  String(name)
    .replace(/(IEPL|IPLC|BGP|RELAY|PRO|V\d+)/gi, " $1 ")
    .replace(/[【】\[\]（）()|_\-.,/:~]/g, " ")
    .replace(/🇭🇰/g, " HK ")
    .replace(/🇹🇼/g, " TW ")
    .replace(/🇸🇬/g, " SG ")
    .replace(/🇯🇵/g, " JP ")
    .replace(/🇰🇷/g, " KR ")
    .replace(/🇻🇳|🇹🇭|🇲🇾|🇮🇩|🇵🇭/g, " AS ")
    .replace(/🇺🇸/g, " US ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const buildRegex = (arr = []) =>
  new RegExp(
    arr
      .map((raw) => {
        const token = String(raw).trim().toUpperCase();
        const escaped = escapeRegex(token);
        return /^[A-Z]{2,3}$/.test(token)
          ? `(?:^|[^A-Z])${escaped}(?:[^A-Z]|$)`
          : escaped;
      })
      .join("|"),
    "i",
  );

const buildRegions = () =>
  [
    {
      name: "HK",
      pattern: ["香港", "HK", "HKG", "HONGKONG", "HONG KONG"],
      icon: "Hong_Kong.png",
    },
    {
      name: "TW",
      pattern: ["台湾", "台北", "新北", "TW", "TWN", "TAIWAN", "TAIPEI", "TPE"],
      icon: "Taiwan.png",
    },
    {
      name: "SG",
      pattern: ["新加坡", "狮城", "SG", "SGP", "SINGAPORE", "SIN"],
      icon: "Singapore.png",
    },
    {
      name: "JP",
      pattern: [
        "日本",
        "东京",
        "大阪",
        "JP",
        "JPN",
        "JAPAN",
        "TOKYO",
        "OSAKA",
        "NRT",
        "HND",
        "TYO",
      ],
      icon: "Japan.png",
    },
    {
      name: "KR",
      pattern: ["韩国", "首尔", "KR", "KOR", "KOREA", "SEOUL", "ICN"],
      icon: "Korea.png",
    },
    {
      name: "AS",
      pattern: [
        "越南",
        "泰国",
        "马来西亚",
        "印尼",
        "菲律宾",
        "VN",
        "TH",
        "MY",
        "ID",
        "PH",
        "VIETNAM",
        "THAILAND",
        "MALAYSIA",
        "INDONESIA",
        "PHILIPPINES",
        "MANILA",
      ],
      icon: "Available.png",
    },
    {
      name: "US",
      pattern: [
        "美国",
        "纽约",
        "洛杉矶",
        "旧金山",
        "圣何塞",
        "西雅图",
        "芝加哥",
        "达拉斯",
        "硅谷",
        "US",
        "USA",
        "UNITEDSTATES",
        "UNITED STATES",
        "NEWYORK",
        "NEW YORK",
        "LOSANGELES",
        "LOS ANGELES",
        "SANFRANCISCO",
        "SAN FRANCISCO",
        "SANJOSE",
        "SAN JOSE",
        "SEATTLE",
        "CHICAGO",
        "DALLAS",
        "LAX",
        "SJC",
        "SFO",
      ],
      icon: "United_States.png",
    },
  ].map((r) => ({ ...r, regex: buildRegex(r.pattern) }));

const REGIONS = buildRegions();
const REGION_LABELS = {
  HK: "🇭🇰 香港节点",
  TW: "🇹🇼 台湾节点",
  SG: "🇸🇬 狮城节点",
  JP: "🇯🇵 日本节点",
  KR: "🇰🇷 韩国节点",
  US: "🇺🇸 美国节点",
  AS: "🗺️ 其他地区",
};

const buildFakeIpFilter = (bypass = []) =>
  uniq([
    "geosite:private",
    "geosite:google-cn",
    "geosite:synology",
    "geosite:cn",
    ...uniq(
      bypass.flatMap((domain) => {
        const d = String(domain || "").trim();
        if (!d) return [];
        return d.includes("*") || d.startsWith("+.") ? [d] : [`+.${d}`];
      }),
    ),
  ]);

const mergeRules = (baseRules = [], extraRules = []) => {
  const extra = Array.isArray(extraRules) ? extraRules.filter(Boolean) : [];
  if (!extra.length) return baseRules.slice();

  const matchIndex = baseRules.findIndex((rule) =>
    /^MATCH,/i.test(String(rule).trim()),
  );

  if (matchIndex === -1) return uniq([...baseRules, ...extra]);

  return uniq([
    ...baseRules.slice(0, matchIndex),
    ...extra,
    ...baseRules.slice(matchIndex),
  ]);
};

const pickDirectRules = (rules = []) =>
  rules.filter((rule) => {
    const r = String(rule || "").trim();
    if (!r || r.startsWith("#")) return false;
    return /,DIRECT(?:,|$)/i.test(r);
  });

// ====================
// 3. 固定规则
// ====================
const RULE_PROVIDERS = {
  direct: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/direct.yml",
    path: "./rulesets/direct.yml",
    interval: 86400,
  },
  proxy: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/proxy.yml",
    path: "./rulesets/proxy.yml",
    interval: 86400,
  },
  hk: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/hk.yml",
    path: "./rulesets/hk.yml",
    interval: 86400,
  },
  tw: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/tw.yml",
    path: "./rulesets/tw.yml",
    interval: 86400,
  },
  jp: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/jp.yml",
    path: "./rulesets/jp.yml",
    interval: 86400,
  },
  kr: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/kr.yml",
    path: "./rulesets/kr.yml",
    interval: 86400,
  },
  us: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/us.yml",
    path: "./rulesets/us.yml",
    interval: 86400,
  },
  ssh: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/YangHgRi/rules/refs/heads/main/clash/ssh.yml",
    path: "./rulesets/ssh.yml",
    interval: 86400,
  },
  SukkaW_cdn_domain: {
    type: "http",
    behavior: "domain",
    url: "https://ruleset.skk.moe/Clash/domainset/cdn.txt",
    path: "./rulesets/sukkaw_cdn_domain.txt",
    interval: 86400,
  },
  SukkaW_cdn_nonip: {
    type: "http",
    behavior: "classical",
    url: "https://ruleset.skk.moe/Clash/non_ip/cdn.txt",
    path: "./rulesets/sukkaw_cdn_nonip.txt",
    interval: 86400,
  },
};

const STATIC_RULES = [
  // 广告拦截
  "GEOSITE,category-ads-all,REJECT",
  // 强制代理域名
  ...uniq(FORCE_PROXY_DOMAINS).map((d) => `DOMAIN,${d},🚀 节点选择`),
  // 自定义直连规则
  "RULE-SET,direct,DIRECT",
  // 自定义代理规则
  "RULE-SET,proxy,🚀 节点选择",
  // 地区自定义规则
  "RULE-SET,us,🇺🇸 美国节点",
  "RULE-SET,hk,🇭🇰 香港节点",
  "RULE-SET,tw,🇹🇼 台湾节点",
  "RULE-SET,jp,🇯🇵 日本节点",
  "RULE-SET,kr,🇰🇷 韩国节点",
  // CDN 静态资源
  "RULE-SET,SukkaW_cdn_domain,☁ 静态资源",
  "RULE-SET,SukkaW_cdn_nonip,☁ 静态资源",
  // 社交媒体（含 Telegram）
  "GEOSITE,category-social-media-!cn,📱 社交媒体",
  "GEOSITE,telegram,📱 社交媒体",
  // AI 平台
  "GEOSITE,category-ai-!cn,💬 Ai平台",
  // 加密货币
  "GEOSITE,category-cryptocurrency,🪙 加密货币",
  // 奈飞
  "GEOSITE,netflix,🎥 奈飞节点",
  // 巴哈姆特
  "GEOSITE,bahamut,📺 巴哈姆特",
  // SSH
  "RULE-SET,ssh,💻 SSH",
  // Google CN / Synology / Sharepoint
  "GEOSITE,google-cn,DIRECT",
  "GEOSITE,synology,DIRECT",
  "DOMAIN-SUFFIX,sharepoint.com,DIRECT",
  // 用户旁路域名
  ...uniq(BYPASS_DOMAINS).map((d) => `DOMAIN-SUFFIX,${d},DIRECT`),
  // 私有网络
  "GEOSITE,private,DIRECT",
  "GEOIP,private,DIRECT,no-resolve",
  // 非中国地区兜底
  "GEOSITE,geolocation-!cn,🚀 节点选择",
  // 中国地区直连
  "GEOSITE,cn,DIRECT",
  "GEOIP,CN,DIRECT,no-resolve",
  // IP 级规则（域名规则之后）
  "GEOIP,telegram,📱 社交媒体,no-resolve",
  "GEOIP,netflix,🎥 奈飞节点,no-resolve",
  // 最终兜底
  "MATCH,🐟 漏网之鱼",
];
const STATIC_FAKE_IP_FILTER = buildFakeIpFilter(BYPASS_DOMAINS);

// ====================
// 4. 节点处理
// ====================
const ensureConfigObject = (input) =>
  input && typeof input === "object" ? input : {};

const getOriginalProxies = (input) =>
  Array.isArray(input.proxies) ? input.proxies : [];

const makeProxyNamesUnique = (proxies = []) => {
  const used = new Set();
  const nextIdx = new Map();

  proxies.forEach((p) => {
    if (!p || !p.name) return;

    const base = String(p.name);

    if (!used.has(base)) {
      used.add(base);
      nextIdx.set(base, 1);
      return;
    }

    let idx = nextIdx.get(base) ?? 1;
    let candidate = `${base}_${idx}`;

    while (used.has(candidate)) candidate = `${base}_${++idx}`;

    p.name = candidate;
    used.add(candidate);
    nextIdx.set(base, idx + 1);
  });
};

const splitInfoAndNormalProxies = (proxies = [], filterRegex) =>
  proxies.reduce(
    (acc, proxy) => {
      if (!proxy || !proxy.name) return acc;
      (filterRegex.test(proxy.name) ? acc.infoProxies : acc.normalProxies).push(
        proxy,
      );
      return acc;
    },
    { infoProxies: [], normalProxies: [] },
  );

const splitLowRateProxies = (proxies = [], filterRegex) =>
  proxies.reduce(
    (acc, proxy) => {
      if (!proxy || !proxy.name) return acc;
      (filterRegex.test(proxy.name)
        ? acc.lowRateProxies
        : acc.cleanProxies
      ).push(proxy);
      return acc;
    },
    { lowRateProxies: [], cleanProxies: [] },
  );

const classifyProxiesByRegion = (normalProxies = [], regions = []) => {
  const regionGroupsData = regions.map((r) => ({
    name: r.name,
    icon: r.icon,
    proxies: [],
  }));
  const regionGroupMap = new Map(regionGroupsData.map((r) => [r.name, r]));
  const regionSeen = new Map(regionGroupsData.map((r) => [r.name, new Set()]));
  const otherProxyNames = [];
  const otherSeen = new Set();

  normalProxies.forEach((proxy) => {
    const proxyName = proxy.name;
    const normName = normalizeName(proxyName);
    const matchedRegion = regions.find((r) => r.regex.test(normName));

    if (matchedRegion) {
      const group = regionGroupMap.get(matchedRegion.name);
      const seen = regionSeen.get(matchedRegion.name);
      if (group && seen && !seen.has(proxyName)) {
        group.proxies.push(proxyName);
        seen.add(proxyName);
      }
    } else if (!otherSeen.has(proxyName)) {
      otherProxyNames.push(proxyName);
      otherSeen.add(proxyName);
    }
  });

  const activeRegions = regionGroupsData
    .map((r) => ({ ...r, proxies: uniq(r.proxies) }))
    .filter((r) => r.proxies.length > 0);

  const activeRegionNameSet = new Set(activeRegions.map((r) => r.name));
  const activeRegionMap = new Map(activeRegions.map((r) => [r.name, r]));

  return {
    activeRegions,
    activeRegionNameSet,
    activeRegionMap,
    otherProxyNames: uniq(otherProxyNames),
  };
};
// ====================
// 5. 策略组
// ====================
const buildProxyGroups = ({
  allNames,
  lowRateNames,
  activeRegionMap,
  activeRegionNameSet,
  otherProxyNames,
  infoNames,
}) => {
  const groups = [];

  const add = (name, type, proxies, icon = "Available.png", extra = {}) => {
    proxies = uniq(proxies);
    if (name && proxies.length) {
      groups.push({
        name,
        type,
        proxies,
        icon: SETTINGS.ICON_BASE + icon,
        ...extra,
      });
    }
  };

  const regionEntries = SETTINGS.REGION_ORDER.filter((rName) =>
    activeRegionNameSet.has(rName),
  );
  const activeLabels = regionEntries.map((rName) => REGION_LABELS[rName]);
  const hasOther = otherProxyNames.length > 0;
  const hasLowRate = lowRateNames.length > 0;

  const pickRegions = (...order) =>
    order
      .filter((rName) => activeRegionNameSet.has(rName))
      .map((rName) => REGION_LABELS[rName]);

  // ================================================================
  // Hidden sub-groups (URL Test / BetterFB) — created first,
  // referenced by visible groups below.  Order within this block
  // is irrelevant because hidden: true hides them from UI.
  // ================================================================

  // --- All ---
  if (allNames.length) {
    add(
      "URL Test - All",
      "url-test",
      allNames,
      "Available.png",
      SETTINGS.URL_TEST_EXTRA,
    );
    add(
      "BetterFB - All",
      "url-test",
      allNames,
      "Available.png",
      SETTINGS.BETTER_FB_EXTRA,
    );
  }

  // --- Other ---
  if (hasOther) {
    add(
      "URL Test - Other",
      "url-test",
      otherProxyNames,
      "Available.png",
      SETTINGS.URL_TEST_EXTRA,
    );
    add(
      "BetterFB - Other",
      "url-test",
      otherProxyNames,
      "Available.png",
      SETTINGS.BETTER_FB_EXTRA,
    );
  }

  // --- Region sub-groups ---
  SETTINGS.REGION_ORDER.forEach((rName) => {
    const region = activeRegionMap.get(rName);
    if (!region) return;
    add(
      `URL Test - ${region.name}`,
      "url-test",
      region.proxies,
      region.icon,
      SETTINGS.URL_TEST_EXTRA,
    );
    add(
      `BetterFB - ${region.name}`,
      "url-test",
      region.proxies,
      region.icon,
      SETTINGS.BETTER_FB_EXTRA,
    );
  });

  // ================================================================
  // Visible groups — in screenshot order
  // ================================================================

  // 1. 🚀 节点选择
  if (allNames.length) {
    add(
      "🚀 节点选择",
      "select",
      [
        ...pickRegions("US", "KR", "JP", "SG", "HK"),
        "✋ 手动选择",
        "🎈 自动选择",
        ...pickRegions("TW"),
        ...(hasLowRate ? ["🧪 低倍率节点"] : []),
        ...(hasOther ? ["🗺️ 其他地区"] : []),
      ],
      "Available.png",
    );
  }

  // 2. ✋ 手动选择
  if (allNames.length) {
    add("✋ 手动选择", "select", allNames, "Available.png");
  }

  // 3. 🎈 自动选择
  if (allNames.length) {
    add("🎈 自动选择", "select", ["URL Test - All"], "Available.png");
  }

  // 4. ☁ 静态资源
  add(
    "☁ 静态资源",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      "DIRECT",
      ...pickRegions("US", "HK", "TW", "JP", "KR", "SG"),
      ...(hasOther ? ["🗺️ 其他地区"] : []),
    ],
    "Available.png",
  );

  // 5. 🧪 低倍率节点
  if (hasLowRate) {
    add("🧪 低倍率节点", "select", lowRateNames, "Available.png");
  }

  // 6. 📱 社交媒体
  add(
    "📱 社交媒体",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      ...pickRegions("US", "HK", "KR", "SG", "JP"),
      ...pickRegions("TW"),
      ...(hasOther ? ["🗺️ 其他地区"] : []),
    ],
    "Available.png",
  );

  // 7. 💬 Ai平台
  add(
    "💬 Ai平台",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      ...pickRegions("US", "SG", "JP", "HK", "KR"),
      ...pickRegions("TW"),
      ...(hasOther ? ["🗺️ 其他地区"] : []),
    ],
    "Available.png",
  );

  // 8. 🪙 加密货币
  add(
    "🪙 加密货币",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      ...pickRegions("US", "HK", "TW", "JP", "KR", "SG"),
      ...(hasOther ? ["🗺️ 其他地区"] : []),
    ],
    "Available.png",
  );

  // 9. 🎮 游戏平台
  add(
    "🎮 游戏平台",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      ...pickRegions("US", "HK", "KR", "SG", "JP"),
      ...pickRegions("TW"),
      ...(hasOther ? ["🗺️ 其他地区"] : []),
    ],
    "Available.png",
  );

  // 10. 🎥 奈飞节点
  add(
    "🎥 奈飞节点",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      ...pickRegions("US", "HK", "SG", "JP", "KR"),
      ...pickRegions("TW"),
      ...(hasOther ? ["🗺️ 其他地区"] : []),
    ],
    "Available.png",
  );

  // 11. 📺 巴哈姆特
  add(
    "📺 巴哈姆特",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      "DIRECT",
      ...pickRegions("TW"),
    ],
    "Available.png",
  );

  // 12. 💻 SSH
  add(
    "💻 SSH",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      ...pickRegions("US", "HK", "TW", "JP", "KR", "SG"),
      "DIRECT",
      ...(hasOther ? ["🗺️ 其他地区"] : []),
    ],
    "Available.png",
  );

  // 13-18. Region select groups
  SETTINGS.REGION_ORDER.forEach((rName) => {
    const region = activeRegionMap.get(rName);
    if (!region) return;
    add(
      REGION_LABELS[region.name],
      "select",
      [
        `BetterFB - ${region.name}`,
        `URL Test - ${region.name}`,
        ...region.proxies,
      ],
      region.icon,
    );
  });

  // 19. 🗺️ 其他地区
  if (hasOther) {
    add(
      "🗺️ 其他地区",
      "select",
      ["BetterFB - Other", "URL Test - Other", ...otherProxyNames],
      "Available.png",
    );
  }

  // 20. 🌍 GLOBAL
  add(
    "🌍 GLOBAL",
    "select",
    [
      ...(allNames.length ? ["🚀 节点选择", "✋ 手动选择", "🎈 自动选择"] : []),
      ...(hasLowRate ? ["🧪 低倍率节点"] : []),
      "DIRECT",
    ],
    "Global.png",
  );

  // 21. 🎯 全球直连
  add("🎯 全球直连", "select", ["DIRECT"], "Available.png");

  // 22. 🐟 漏网之鱼
  if (allNames.length) {
    add("🐟 漏网之鱼", "select", ["🚀 节点选择"], "Available.png");
  }

  // --- Auxiliary: All ---
  if (allNames.length) {
    add(
      "All",
      "select",
      ["BetterFB - All", "URL Test - All", ...allNames],
      "Available.png",
    );
  }

  // --- Auxiliary: info ---
  if (infoNames.length) {
    add("info", "select", infoNames, "Available.png");
  }

  return groups;
};

// ====================
// 6. 网络配置
// ====================
const applyGeoData = (cfg) => {
  cfg["geodata-mode"] = true;
  cfg["geo-auto-update"] = true;
  cfg["geo-update-interval"] = 24;
  cfg["geox-url"] = {
    ...(cfg["geox-url"] || {}),
    geoip: SETTINGS.GEOIP_URL,
    geosite: SETTINGS.GEOSITE_URL,
  };
};

const applySniffer = (cfg) => {
  cfg.sniffer = {
    ...(cfg.sniffer || {}),
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": true,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] },
    },
  };
};

const applyTun = (cfg) => {
  cfg.tun = {
    ...(cfg.tun || {}),
    enable: true,
    stack: "system",
    "auto-route": true,
    "auto-detect-interface": true,
    "strict-route": false,
    "dns-hijack": ["any:53", "tcp://any:53"],
  };
};

const applyDns = (cfg) => {
  const dns = cfg.dns || {};
  const fakeIpFilterFromCfg = Array.isArray(dns["fake-ip-filter"])
    ? dns["fake-ip-filter"]
    : [];
  const nameserverPolicyFromCfg =
    dns["nameserver-policy"] && typeof dns["nameserver-policy"] === "object"
      ? dns["nameserver-policy"]
      : {};

  const chinaDNS = [
    "system",
    "https://dns.alidns.com/dns-query",
    "https://doh.pub/dns-query",
  ];

  const foreignDNS = ["https://1.1.1.1/dns-query#🚀 节点选择"];

  const directGeoForChinaDNS = [
    "geosite:cn",
    "geosite:google-cn",
    "geosite:synology",
    "geosite:googlefcm",
    "geosite:epicgames",
    "geosite:nvidia@cn",
    "geosite:microsoft@cn",
    "geosite:cloudflare@cn",
    "geosite:steam@cn",
    "geosite:category-ntp",
    "geosite:connectivity-check",
    "geosite:apple",
    "geosite:spotify",
    "geosite:microsoft",
  ];

  const directPolicy = {};
  directGeoForChinaDNS.forEach((geo) => {
    directPolicy[geo] = chinaDNS;
  });
  directPolicy["geosite:private"] = "system";

  const forceProxyPolicy = {};
  uniq(FORCE_PROXY_DOMAINS).forEach((d) => {
    const domain = String(d || "").trim();
    if (domain) forceProxyPolicy[domain] = foreignDNS;
  });

  const fullFakeIpFilter = uniq([
    "+.cn",
    "geosite:private",
    ...directGeoForChinaDNS,
    ...STATIC_FAKE_IP_FILTER,
    ...fakeIpFilterFromCfg,
  ]);

  cfg.dns = {
    ...dns,
    enable: true,
    listen: "0.0.0.0:1053",
    ipv6: false,
    "cache-algorithm": "arc",
    "prefer-h3": false,
    "use-hosts": true,
    "use-system-hosts": true,
    "respect-rules": false,
    "enhanced-mode": "fake-ip",
    "fake-ip-filter-mode": "blacklist",
    "fake-ip-filter": fullFakeIpFilter,
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    "nameserver-policy": {
      ...nameserverPolicyFromCfg,
      ...directPolicy,
      "*": "system",
      "+.arpa": "system",
      ...forceProxyPolicy,
    },
    nameserver: foreignDNS,
    "proxy-server-nameserver": [
      "https://doh.pub/dns-query#DIRECT",
      "https://dns.alidns.com/dns-query#DIRECT",
    ],
    "direct-nameserver": ["system", "223.5.5.5", "119.29.29.29"],
    "direct-nameserver-follow-policy": true,
  };

  cfg.hosts = {
    "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],
    "doh.pub": ["1.12.12.12", "120.53.53.53"],

    // 解决谷歌商店无法下载的问题
    "services.googleapis.cn": ["services.googleapis.com"],

    // 屏蔽哔哩哔哩PCDN，解决访问视频卡顿问题
    "+.mcdn.bilivideo.com": ["0.0.0.0"],
    "+.mcdn.bilivideo.cn": ["0.0.0.0"],
  };
};

const applyProfile = (cfg) => {
  cfg.profile = {
    ...(cfg.profile || {}),
    "store-selected": true,
    "store-fake-ip": false,
  };
};

const applyRuntime = (cfg) => {
  cfg.mode = "rule";
  cfg["log-level"] = "warning";
};

// ====================
// 7. 主流程
// ====================
function main(config) {
  config = ensureConfigObject(config);

  const originalProxies = getOriginalProxies(config);
  const existingRules = Array.isArray(config.rules) ? config.rules : [];

  config["rule-providers"] = {
    ...(config["rule-providers"] || {}),
    ...RULE_PROVIDERS,
  };
  config.rules = mergeRules(STATIC_RULES, pickDirectRules(existingRules));

  if (originalProxies.length) {
    makeProxyNamesUnique(originalProxies);

    const { infoProxies, normalProxies } = splitInfoAndNormalProxies(
      originalProxies,
      SETTINGS.FILTER_REGEX,
    );

    const { lowRateProxies, cleanProxies } = splitLowRateProxies(
      normalProxies,
      SETTINGS.LOW_RATE_REGEX,
    );

    const baseProxies = cleanProxies;
    const allNames = uniq([
      ...baseProxies.map((p) => p.name),
      ...lowRateProxies.map((p) => p.name),
    ]);
    const infoNames = uniq(infoProxies.map((p) => p.name));
    const lowRateNames = uniq(lowRateProxies.map((p) => p.name));

    const {
      activeRegions,
      activeRegionNameSet,
      activeRegionMap,
      otherProxyNames,
    } = classifyProxiesByRegion(baseProxies, REGIONS);

    config["proxy-groups"] = buildProxyGroups({
      allNames,
      lowRateNames,
      activeRegionMap,
      activeRegionNameSet,
      otherProxyNames,
      infoNames,
    });

    config.proxies = originalProxies;
  }

  applyGeoData(config);
  applyRuntime(config);
  applySniffer(config);
  applyTun(config);
  applyDns(config);
  applyProfile(config);

  return config;
}
