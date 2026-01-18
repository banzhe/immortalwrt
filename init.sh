#!/bin/sh

UCI_DEFAULTS_PATH="files/etc/uci-defaults/99-custom-settings"

mkdir -p "$(dirname "$UCI_DEFAULTS_PATH")"
cat >"$UCI_DEFAULTS_PATH" <<'EOF'
#!/bin/sh

# 修改 LAN 口为 DHCP 协议
uci set network.lan.proto='dhcp'
# 移除之前可能存在的静态 IP 设置（可选）
uci delete network.lan.ipaddr
uci delete network.lan.netmask
uci delete network.lan.ip6assign

# 关闭 LAN 口的 DHCP 服务 (DHCP Server)
# 如果 dhcp.lan 不存在，uci 会报错，所以先尝试设置
uci set dhcp.lan.ignore='1'

# 禁用 LAN 口的路由通告服务
uci set dhcp.lan.ra='disabled'
# 禁用 LAN 口的 DHCPv6 服务
uci set dhcp.lan.dhcpv6='disabled'
# 禁用 LAN 口的 NDP 代理 (Neighbor Discovery Protocol)
uci set dhcp.lan.ndp='disabled'
# 禁用主接口的主动探测
uci set dhcp.lan.ra_management='0'

# 移除全局 IPv6 唯一本地地址 (ULA) 前缀
uci delete network.globals.ula_prefix
# 禁用 LAN 口的 IPv6 分配前缀长度
uci delete network.lan.ip6assign

# 提交修改
uci commit network
uci commit dhcp
EOF
chmod 755 "$UCI_DEFAULTS_PATH"

# 下载并安装 OpenClash core
CORE_URL="https://github.com/vernesong/OpenClash/raw/refs/heads/core/master/meta/clash-linux-amd64-v1.tar.gz"
CORE_DIR="files/etc/openclash/core"
CORE_TMP_TAR="/tmp/clash-linux-amd64-v1.tar.gz"
CORE_TMP_DIR="/tmp/openclash_core"

mkdir -p "$CORE_DIR" "$CORE_TMP_DIR"
if wget -O "$CORE_TMP_TAR" "$CORE_URL"; then
  tar -xzf "$CORE_TMP_TAR" -C "$CORE_TMP_DIR"
  if [ -f "$CORE_TMP_DIR/clash" ]; then
    mv "$CORE_TMP_DIR/clash" "$CORE_DIR/clash_meta"
    chmod 777 "$CORE_DIR/clash_meta"
  fi
fi

exit 0
