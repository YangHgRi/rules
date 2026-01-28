const onGenerate = async (config) => {
  // 仅保留原始配置中的代理节点（即包含 server 属性的出站）
  const proxyNodes = config.outbounds.filter(o => o.server);

  // 1. 日志配置 (Log)
  config.log = {
    "disabled": false,
    "level": "info",
    "output": "box.log",
    "timestamp": true
  };

  // 2. 实验性功能 (Experimental)
  config.experimental = {
    "clash_api": {
      "external_controller": "127.0.0.1:9090",
      "external_ui": "ui",
      "secret": "",
      "default_mode": "rule"
    },
    "cache_file": {
      "enabled": true,
      "path": "cache.db"
    }
  };

  // 3. 入站连接 (Inbounds)
  config.inbounds = [
    {
      "type": "tun",
      "tag": "tun-in",
      "interface_name": "TUN_Name",
      "inet4_address": "172.19.0.1/30",
      "mtu": 1500,
      "auto_route": true,
      "strict_route": true,
      "stack": "system"
    },
    {
        "type": "mixed",
        "tag": "mixed-in",
        "listen": "127.0.0.1",
        "listen_port": 7890
    }
  ];

  // 4. DNS 配置
  config.dns = {
    "servers": [
      {
        "tag": "local-dns",
        "address": "223.5.5.5",
        "detour": "direct"
      },
      {
        "tag": "remote-dns",
        "address": "1.1.1.1",
        "detour": "proxy"
      }
    ],
    "rules": [
      {
        "server": "local-dns",
        "rule_set": ["geosite-cn"]
      },
      {
          "rule_set": ["geosite-geolocation-!cn"],
          "server": "remote-dns"
      }
    ],
    "final": "local-dns",
    "strategy": "ipv4_only"
  };

  // 5. 路由配置 (Route)
  config.route = {
    "rule_set": [
      {
        "tag": "geosite-cn",
        "type": "remote",
        "format": "binary",
        "url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/cn.srs",
        "download_detour": "direct"
      },
      {
        "tag": "geosite-geolocation-!cn",
        "type": "remote",
        "format": "binary",
        "url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-!cn.srs",
        "download_detour": "proxy"
      }
    ],
    "rules": [
      {
        "protocol": "dns",
        "outbound": "dns-out"
      },
      {
          "rule_set": "geosite-cn",
          "outbound": "direct"
      },
      {
          "rule_set": "geosite-geolocation-!cn",
          "outbound": "proxy"
      }
    ],
    "final": "proxy"
  };
  
  // 6. 动态生成出站连接和策略组
  const outbounds = [];
  const groups = {}; // 用于按国家/地区对节点进行分组
  const countryTags = [];

  // 定义国家/地区和对应的 emoji/关键字
  const countryMapping = {
    '🇭🇰 香港': ['香港', 'HK'],
    '🇯🇵 日本': ['日本', 'JP'],
    '🇺🇸 美国': ['美国', 'US'],
    '🇸🇬 狮城': ['狮城', '新加坡', 'SG'],
    '🇰🇷 韩国': ['韩国', 'KR'],
    '🇬🇧 英国': ['英国', 'UK'],
    '🇹🇼 台湾': ['台湾', 'TW'],
  };

  // 初始化分组
  for (const tag in countryMapping) {
    groups[tag] = [];
    countryTags.push(tag);
  }
  groups['其他'] = [];

  // 将节点分类到对应的国家/地区分组
  proxyNodes.forEach(node => {
    let found = false;
    for (const tag in countryMapping) {
      if (countryMapping[tag].some(keyword => node.tag.includes(keyword))) {
        groups[tag].push(node.tag);
        found = true;
        break;
      }
    }
    if (!found) {
      groups['其他'].push(node.tag);
    }
  });

  // 添加内置出站
  outbounds.push({ "tag": "direct", "type": "direct" });
  outbounds.push({ "tag": "block", "type": "block" });
  outbounds.push({ "tag": "dns-out", "type": "dns" });

  // 添加顶层策略组
  outbounds.push({
    "tag": "🚀 节点选择",
    "type": "selector",
    "outbounds": ["🎈 自动选择", ...countryTags.filter(tag => groups[tag].length > 0)]
  });
  outbounds.push({
    "tag": "🎈 自动选择",
    "type": "urltest",
    "url": "http://www.gstatic.com/generate_204",
    "interval": "5m",
    "outbounds": proxyNodes.map(n => n.tag)
  });
   outbounds.push({
    "tag": "🎥 奈飞节点",
    "type": "selector",
    "outbounds": ["🚀 节点选择", ...countryTags.filter(tag => groups[tag].length > 0)]
  });

  // 为每个有节点的国家/地区创建 urltest 策略组
  for (const tag in groups) {
    if (groups[tag].length > 0) {
      const isCountryGroup = tag !== '其他';
      outbounds.push({
        "tag": isCountryGroup ? tag : '其他节点',
        "type": "urltest",
        "url": "http://www.gstatic.com/generate_204",
        "interval": "5m",
        "outbounds": groups[tag]
      });
    }
  }

  // 添加所有原始代理节点
  outbounds.push(...proxyNodes);

  // 更新 config 对象的 outbounds
  config.outbounds = outbounds;

  return config;
};
