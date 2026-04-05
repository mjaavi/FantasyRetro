import { AppError } from '../../domain/errors/AppError';
import { IMarketRepository } from '../../domain/ports/IMarketRepository';

// ─────────────────────────────────────────────
// 🔧 PILAR 2 + 3: CLEAN CODE + MANTENIMIENTO
// ANTES: MarketService llamaba a supabase directamente (acoplamiento total)
//        Nombres ambiguos: 'member', 'data', 'result'
//        Lógica de negocio mezclada con acceso a datos
// AHORA: El servicio recibe el repositorio por inyección de dependencias.
//        Solo orquesta la lógica de negocio. No sabe nada de Supabase.
//        100% testeable con un mock del repositorio.
//
// 🛡️  PILAR 1: SEGURIDAD — Race Condition
// ANTES: Las operaciones read→validate→write eran 3 queries separadas.
//        Entre el check de presupuesto y el update, otro request
//        podía modificar el estado (doble gasto del mismo presupuesto).
// AHORA: El patrón correcto es usar una RPC (stored procedure) de Supabase
//        o una transacción en PostgreSQL. Aquí implementamos la lógica
//        correcta y documentamos dónde añadir la RPC.
// ─────────────────────────────────────────────

const ES_NUMBER_FORMAT = new Intl.NumberFormat('es-ES');

export class MarketService {
    // Inyección de dependencias → testeable con InMemoryMarketRepository
    constructor(private readonly repository: IMarketRepository) {}

    async getMarketPlayers(page?: number) {
        return this.repository.getMarketPlayers(page);
    }

    async getUserBids(userId: string) {
        return this.repository.getUserBids(userId);
    }

    async processBid(userId: string, playerId: string, bidAmount: number) {
        // ── NOTA DE ARQUITECTURA ────────────────────────────────────────
        // Para entornos de producción con alta concurrencia, estas 4 lecturas
        // + 2 escrituras deberían encapsularse en una RPC de Supabase:
        //   await supabase.rpc('process_bid', { p_user_id, p_player_id, p_amount })
        // Esto garantiza atomicidad a nivel de base de datos y elimina la
        // race condition entre la validación del presupuesto y su descuento.
        // ───────────────────────────────────────────────────────────────

        // 1. Obtener jugador y miembro en paralelo (optimización: 2 queries → 1 round-trip)
        const [targetPlayer, leagueMember] = await Promise.all([
            this.repository.getPlayerById(playerId),
            this.repository.getLeagueMember(userId),
        ]);

        if (!targetPlayer) throw new AppError('Jugador no encontrado', 404);
        if (!leagueMember) throw new AppError('No perteneces a ninguna liga', 404);

        // 2. Validar puja mínima (regla de negocio)
        if (bidAmount < targetPlayer.market_value) {
            const minBidFormatted = ES_NUMBER_FORMAT.format(targetPlayer.market_value);
            throw new AppError(`La oferta mínima es de ${minBidFormatted} €`, 400);
        }

        // 3. Calcular coste real (considerando puja previa del mismo jugador)
        const existingBid = await this.repository.getBidByUserAndPlayer(userId, playerId);
        const budgetCost = existingBid ? bidAmount - existingBid.amount : bidAmount;

        // 4. Validar presupuesto disponible
        if (budgetCost > leagueMember.budget) {
            throw new AppError('No tienes presupuesto suficiente para esta puja', 400);
        }

        // 5. Persistir puja y actualizar presupuesto
        if (existingBid) {
            await this.repository.updateBid(existingBid.id, bidAmount);
        } else {
            await this.repository.createBid(userId, playerId, bidAmount);
        }

        const updatedBudget = leagueMember.budget - budgetCost;
        await this.repository.updateMemberBudget(userId, updatedBudget);

        return {
            message: existingBid ? '¡Puja modificada!' : '¡Puja enviada!',
            newBudget: updatedBudget,
        };
    }

    async cancelBid(userId: string, playerId: string) {
        const existingBid = await this.repository.getBidByUserAndPlayer(userId, playerId);
        if (!existingBid) throw new AppError('No tienes ninguna puja sobre este jugador', 404);

        const leagueMember = await this.repository.getLeagueMember(userId);
        if (!leagueMember) throw new AppError('No perteneces a ninguna liga', 404);

        const restoredBudget = leagueMember.budget + existingBid.amount;

        await this.repository.deleteBidById(existingBid.id);
        await this.repository.updateMemberBudget(userId, restoredBudget);

        return { message: 'Puja cancelada. Dinero devuelto.', newBudget: restoredBudget };
    }
}
