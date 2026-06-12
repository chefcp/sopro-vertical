import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conta } from "@/lib/types";

/**
 * Wrappers das RPC que escrevem no livro de lançamentos.
 * REGRA DE OURO: o cliente NUNCA insere em `lancamentos` à mão.
 * Cria/edita os dados operacionais e chama uma destas funções.
 */

/** Recalcula os lançamentos de um custo (depois de o criar/editar). */
export function lancarCusto(supabase: SupabaseClient, custoId: string) {
  return supabase.rpc("lancar_custo", { p_custo_id: custoId });
}

/** Recalcula os lançamentos de uma reserva (depois de a criar/editar). */
export function lancarReserva(supabase: SupabaseClient, reservaId: string) {
  return supabase.rpc("lancar_reserva", { p_reserva_id: reservaId });
}

/** Redistribui o saldo de uma conta de um CC pelos destinos da chave. */
export function redistribuirConta(
  supabase: SupabaseClient,
  origemCc: string,
  conta: Conta,
) {
  return supabase.rpc("redistribuir_conta", {
    p_origem_cc: origemCc,
    p_conta: conta,
  });
}

/** Distribui um reembolso de IVA recebido, até ao saldo de IVA de cada CC. */
export function distribuirReembolsoIva(
  supabase: SupabaseClient,
  orgId: string,
  valor: number,
) {
  return supabase.rpc("distribuir_reembolso_iva", {
    p_org: orgId,
    p_valor: valor,
  });
}

/** Paga ao dono (sem travão; tesouraria e suprimentos podem ficar negativos). */
export function pagarDono(supabase: SupabaseClient, cc: string, valor: number) {
  return supabase.rpc("pagar_dono", { p_cc: cc, p_valor: valor });
}

/** Transfere um valor entre dois centros de custo (conta-corrente). */
export function transferirCc(
  supabase: SupabaseClient,
  origemCc: string,
  destinoCc: string,
  valor: number,
) {
  return supabase.rpc("transferir_cc", {
    p_origem_cc: origemCc,
    p_destino_cc: destinoCc,
    p_valor: valor,
  });
}

/** Reparte um custo geral por casas usando os pesos (cria as alocações). */
export function repartirCusto(
  supabase: SupabaseClient,
  custoId: string,
  centroCustoId: string,
) {
  return supabase.rpc("repartir_custo", {
    p_custo_id: custoId,
    p_centro_custo_id: centroCustoId,
  });
}
