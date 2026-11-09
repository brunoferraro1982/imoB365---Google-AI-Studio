import {
  ETAPAS_CHECKLIST,
  ETAPAS_EXIGEM_DOCUMENTO,
  type EtapaChecklist,
} from "@/lib/checklistContratos";

export type ItemStatus = {
  id: string;
  etapa: string;
  titulo: string;
  obrigatorio: boolean;
  concluido: boolean;
};

export type EstadoEtapa = {
  etapa: EtapaChecklist;
  label: string;
  total: number;
  feitos: number;
  pendentesObrigatorios: number;
  vazia: boolean;
  exigeDocumento: boolean;
  /** exige documento e não tem nenhum item cadastrado */
  semDocumentos: boolean;
};

export type AnaliseChecklist = {
  semChecklist: boolean;
  porEtapa: Record<EtapaChecklist, EstadoEtapa>;
  etapasSemDocumento: EtapaChecklist[];
  /** pendências obrigatórias da etapa informada (bloqueiam o avanço) */
  pendentesEtapaAtual: ItemStatus[];
  /** total de obrigatórios pendentes em todo o contrato */
  pendentesTotal: number;
};

/** Analisa os itens do contrato para a etapa atual (função pura, reutilizável). */
export function analisarChecklist(itens: ItemStatus[], etapaAtual: string): AnaliseChecklist {
  const porEtapa = {} as Record<EtapaChecklist, EstadoEtapa>;
  for (const e of ETAPAS_CHECKLIST) {
    const lista = itens.filter((i) => i.etapa === e.value);
    const exige = ETAPAS_EXIGEM_DOCUMENTO.includes(e.value);
    porEtapa[e.value] = {
      etapa: e.value,
      label: e.label,
      total: lista.length,
      feitos: lista.filter((i) => i.concluido).length,
      pendentesObrigatorios: lista.filter((i) => i.obrigatorio && !i.concluido).length,
      vazia: lista.length === 0,
      exigeDocumento: exige,
      semDocumentos: exige && lista.length === 0,
    };
  }
  const etapasSemDocumento = ETAPAS_CHECKLIST.map((e) => e.value as EtapaChecklist).filter(
    (e) => porEtapa[e].semDocumentos,
  );
  return {
    semChecklist: itens.length === 0,
    porEtapa,
    etapasSemDocumento,
    pendentesEtapaAtual: itens.filter(
      (i) => i.etapa === etapaAtual && i.obrigatorio && !i.concluido,
    ),
    pendentesTotal: itens.filter((i) => i.obrigatorio && !i.concluido).length,
  };
}
