// Cliente server-only da API da Hostinger (métricas reais da VPS de produção).
// SECURITY: HOSTINGER_API_TOKEN nunca deve ser exposto ao cliente — importar
// este arquivo somente em server functions / rotas de servidor.
//
// Endpoints e formato de resposta confirmados empiricamente contra a API real
// (não só a doc pública, que está desatualizada em pelo menos um campo — ver
// nota em `uptimeSeconds` abaixo) antes de escrever este arquivo.
const HOSTINGER_API_BASE = "https://developers.hostinger.com";

export type HostingerVmInfo = {
  id: number;
  hostname: string;
  state: string;
  cpus: number;
  memoryMb: number;
  diskMb: number;
  ipv4: string | null;
};

export type HostingerMetricPoint = { timestamp: number; value: number };

export type HostingerMetrics = {
  cpuUsagePercent: HostingerMetricPoint[];
  ramUsageBytes: HostingerMetricPoint[];
  diskUsageBytes: HostingerMetricPoint[];
  // A doc pública da Hostinger diz "uptime em milissegundos" — o dado real
  // retornado pela API vem em SEGUNDOS (confirmado testando ao vivo: valores
  // como 662341 só fazem sentido como ~7.7 dias em segundos, não em ms).
  uptimeSeconds: HostingerMetricPoint[];
};

function getCredentials(): { token: string; vpsId: string } | null {
  const token = process.env.HOSTINGER_API_TOKEN;
  const vpsId = process.env.HOSTINGER_VPS_ID;
  if (!token || !vpsId) return null;
  return { token, vpsId };
}

function toPoints(
  resource: { unit: string; usage: Record<string, number> } | null | undefined,
): HostingerMetricPoint[] {
  if (!resource?.usage) return [];
  return Object.entries(resource.usage)
    .map(([ts, value]) => ({ timestamp: Number(ts), value }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function getVpsInfo(): Promise<HostingerVmInfo | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const res = await fetch(`${HOSTINGER_API_BASE}/api/vps/v1/virtual-machines/${creds.vpsId}`, {
    headers: { Authorization: `Bearer ${creds.token}` },
  });
  if (!res.ok) {
    console.error("[hostinger] falha ao buscar detalhes da VPS", res.status);
    return null;
  }
  const data = await res.json();
  return {
    id: data.id,
    hostname: data.hostname,
    state: data.state,
    cpus: data.cpus,
    memoryMb: data.memory,
    diskMb: data.disk,
    ipv4: data.ipv4?.[0]?.address ?? null,
  };
}

export async function getVpsMetrics(
  dateFrom: Date,
  dateTo: Date,
): Promise<HostingerMetrics | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const params = new URLSearchParams({
    date_from: dateFrom.toISOString(),
    date_to: dateTo.toISOString(),
  });
  const res = await fetch(
    `${HOSTINGER_API_BASE}/api/vps/v1/virtual-machines/${creds.vpsId}/metrics?${params}`,
    { headers: { Authorization: `Bearer ${creds.token}` } },
  );
  if (!res.ok) {
    console.error("[hostinger] falha ao buscar métricas da VPS", res.status);
    return null;
  }
  const data = await res.json();
  return {
    cpuUsagePercent: toPoints(data.cpu_usage),
    ramUsageBytes: toPoints(data.ram_usage),
    diskUsageBytes: toPoints(data.disk_space),
    uptimeSeconds: toPoints(data.uptime),
  };
}
