import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatBRL } from "@/lib/format";

// Fix default icon paths (Leaflet quirk com bundlers)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type ImovelMapPoint = {
  id: string;
  slug: string;
  titulo: string;
  preco: number;
  latitude: number;
  longitude: number;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  capa_url?: string | null;
};

function ClusterLayer({ pontos }: { pontos: ImovelMapPoint[] }) {
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);
  const navigate = useNavigate();

  // Resize invalidation effect to completely solve intermittent map loading / grey boxes
  useEffect(() => {
    if (mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [pontos]);

  // Click interceptor to parse .spa-link clicks in Leaflet and navigate using the TanStack Router
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current.getContainer();

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest(".spa-link");
      if (link) {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href) {
          navigate({ to: href });
        }
      }
    };

    container.addEventListener("click", handleContainerClick);
    return () => {
      container.removeEventListener("click", handleContainerClick);
    };
  }, [navigate]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (clusterRef.current) {
      mapRef.current.removeLayer(clusterRef.current);
    }
    const cluster = (L as any).markerClusterGroup({ chunkedLoading: true });
    pontos.forEach((p) => {
      const m = L.marker([p.latitude, p.longitude]);
      const html = `
        <div style="min-width:200px">
          ${p.capa_url ? `<img src="${p.capa_url}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:6px" />` : ""}
          <div style="font-weight:600;font-size:13px;line-height:1.2">${escapeHtml(p.titulo)}</div>
          <div style="font-size:11px;color:#666;margin-top:2px">${escapeHtml([p.endereco_bairro, p.endereco_cidade].filter(Boolean).join(" · "))}</div>
          <div style="font-weight:700;color:#0a6;margin-top:4px">${formatBRL(p.preco)}</div>
          <a href="/imovel/${p.slug}" class="spa-link" style="display:inline-block;margin-top:6px;font-size:12px;color:#06f;text-decoration:underline;font-weight:600">Ver detalhes</a>
        </div>`;
      m.bindPopup(html);
      cluster.addLayer(m);
    });
    clusterRef.current = cluster;
    mapRef.current.addLayer(cluster);

    if (pontos.length > 0) {
      const bounds = L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [pontos]);

  return (
    <MapContainer
      center={[-23.55, -46.63]}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      ref={(m) => { mapRef.current = m; }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function MapaImoveis({ pontos }: { pontos: ImovelMapPoint[] }) {
  return (
    <div className="h-[600px] w-full overflow-hidden rounded-xl border border-border">
      {pontos.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Nenhum imóvel com localização para exibir no mapa.
        </div>
      ) : (
        <ClusterLayer pontos={pontos} />
      )}
    </div>
  );
}

// Re-export Link if needed by external popup logic in future
export { Link };