/**
 * us_fixed_ip.js — GLaDOS 固定 IP 出站聚合钩子
 *
 * 功能：
 *   从 sing-box 配置的 outbounds 中筛选出 GLaDOS 美国固定 IP 节点
 *   （命名格式：US-Dedicated-F1-* / US-Dedicated-F2-*），
 *   将它们汇总为一个名为 "🇺🇸 Fixed IP" 的 selector 出站组，
 *   并将该组置为 "💬 Ai平台" 出站组的默认首选项。
 *
 * 适用场景：
 *   AI 平台（如 ChatGPT、Claude）需要固定出口 IP 以避免频繁触发风控，
 *   通过本钩子将固定 IP 节点优先暴露为 Ai平台 的默认路由。
 *
 * 触发方式：
 *   作为 onGenerate 钩子由 sing-box 配置生成器调用，
 *   接收并返回完整的 config 对象。
 */

const onGenerate = async (config) => {
  // 匹配 GLaDOS 美国固定 IP 节点的命名规则：
  // US-Dedicated-F1-<序号> 或 US-Dedicated-F2-<序号>
  const FIXED_IP_PATTERN = /US-Dedicated-F[12]-\d+/;

  const outbounds = config.outbounds ?? [];

  // 筛选所有匹配固定 IP 命名规则的出站节点，并按序号自然排序，
  // 确保 F1-1 < F1-2 < F1-10 而非字典序的 F1-1 < F1-10 < F1-2。
  const fixedIpTags = outbounds
    .filter((o) => FIXED_IP_PATTERN.test(o.tag ?? ""))
    .map((o) => o.tag)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // 没有匹配节点时跳过，不修改配置，保持幂等性。
  if (fixedIpTags.length === 0) {
    return config;
  }

  // 构造固定 IP 聚合选择器，切换节点时断开现有连接以立即生效。
  const usFixedIpOutbound = {
    type: "selector",
    tag: "🇺🇸 Fixed IP",
    outbounds: fixedIpTags,
    interrupt_exist_connections: true,
  };

  // 将 "🇺🇸 Fixed IP" 插入 "💬 Ai平台" outbounds 的首位，使其成为默认选项。
  // 不存在该出站组时静默跳过，不报错。
  const aiOutbound = outbounds.find((o) => o.tag === "💬 Ai平台");
  if (aiOutbound) {
    aiOutbound.outbounds = ["🇺🇸 Fixed IP", ...aiOutbound.outbounds];
  }

  // 将新出站组追加到 outbounds 列表末尾并返回修改后的完整配置。
  config.outbounds = [...outbounds, usFixedIpOutbound];

  return config;
};
