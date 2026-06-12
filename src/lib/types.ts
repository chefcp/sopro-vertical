/**
 * Tipos das views e tabelas usadas pelo frontend.
 * Escritos a partir do esquema real confirmado no Supabase.
 * Saldos vêm sempre das views (nunca recalculados no cliente).
 */

export type Conta =
  | "resultado"
  | "iva"
  | "suprimentos"
  | "tesouraria"
  | "cc_corrente";

/** vw_resumo_centro_custo */
export interface ResumoCentroCusto {
  centro_custo_id: string;
  nome: string;
  gera_faturacao: boolean;
  dono_id: string | null;
  resultado: number;
  saldo_iva: number;
  saldo_suprimentos: number;
  saldo_tesouraria: number;
  saldo_cc_corrente: number;
  ordem: number;
}

/** vw_resumo_casa */
export interface ResumoCasa {
  casa_id: string;
  nome: string;
  centro_custo_id: string;
  peso_base: number;
  resultado: number;
  saldo_iva: number;
}

/** vw_suprimentos_por_pessoa */
export interface SuprimentosPorPessoa {
  centro_custo_id: string;
  pessoa_id: string;
  saldo: number;
}

/** vw_conta_corrente_cc */
export interface ContaCorrenteCC {
  centro_custo_id: string;
  contraparte_cc_id: string;
  saldo: number;
}

/** reservas */
export interface Reserva {
  id: string;
  casa_id: string;
  canal: string | null;
  data_checkin: string | null;
  data_checkout: string | null;
  valor_total: number;
  iva_liquidado: number;
  faturado: boolean;
  taxa_canal: number;
  comissao_stripe: number;
  liquido: number;
  fora_sopro: boolean;
  ical_uid: string | null;
  externo_id: string | null;
  fonte: string | null;
  hospede: string | null;
  estado: "ativa" | "cancelada";
  editada_manual: boolean;
  validada: boolean;
  recebido: boolean;
  data_recebimento: string | null;
  valor_recebido: number | null;
}

/** fontes_reserva — de onde vêm as reservas de cada casa */
export type FonteTipo =
  | "airbnb_ical"
  | "vrbo_ical"
  | "lodgify_api"
  | "outro_ical";

export interface FonteReserva {
  id: string;
  casa_id: string;
  tipo: FonteTipo;
  referencia: string;
  ativo: boolean;
}

/** lancamentos (livro de lançamentos) */
export interface Lancamento {
  id: string;
  data: string;
  centro_custo_id: string;
  casa_id: string | null;
  conta: Conta;
  valor: number;
  origem: string | null;
  descricao: string | null;
}

/** custos */
export type PagoPorTipo = "sopro" | "pessoa" | "cc";

export interface Custo {
  id: string;
  fornecedor: string;
  nif: string | null;
  descricao: string | null;
  data: string;
  valor_base: number;
  iva: number;
  total: number | null;
  pago_por_tipo: PagoPorTipo;
  pago_por_pessoa_id: string | null;
  pago_por_cc_id: string | null;
  atcud: string | null;
}

/** alocacoes (de um custo por CC/casa) */
export interface Alocacao {
  centro_custo_id: string;
  casa_id: string | null;
  percentagem: number;
}

/** membros */
export interface Membro {
  org_id: string;
  user_id: string;
  papel: string;
}

/** organizacoes */
export interface Organizacao {
  id: string;
  nome: string;
  nif: string | null;
  morada: string | null;
  criado_em: string;
}

/** pessoas */
export interface Pessoa {
  id: string;
  org_id: string;
  nome: string;
  criado_em: string;
}
