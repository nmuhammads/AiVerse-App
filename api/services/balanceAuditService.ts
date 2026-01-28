/**
 * Balance Audit Log Service
 * Логирование всех изменений баланса пользователей
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function supaHeaders() {
    return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } as Record<string, string>;
}

export type BalanceChangeReason =
    | 'generation'       // Списание за генерацию
    | 'refund'           // Возврат токенов (failed генерация)
    | 'payment'          // Пополнение баланса (оплата)
    | 'spin'             // Награда за spin
    | 'wheel'            // Награда за колесо фортуны
    | 'admin'            // Ручное изменение администратором
    | 'watermark'        // Списание за удаление watermark
    | 'chat'             // Списание за чат
    | 'editor'           // Списание за editor
    | 'channel_reward'   // Награда за подписку на канал
    | 'referral'         // Реферальный бонус
    | 'promo';           // Промокод


export interface BalanceChangeParams {
    userId: number;
    oldBalance: number;
    newBalance: number;
    reason: BalanceChangeReason;
    referenceId?: string | number;
    metadata?: Record<string, unknown>;
}

/**
 * Записывает изменение баланса в audit log
 */
export async function logBalanceChange(params: BalanceChangeParams): Promise<void> {
    const { userId, oldBalance, newBalance, reason, referenceId, metadata } = params;
    const changeAmount = newBalance - oldBalance;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/balance_audit_log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                user_id: userId,
                old_balance: oldBalance,
                new_balance: newBalance,
                change_amount: changeAmount,
                reason,
                reference_id: referenceId?.toString() || null,
                metadata: metadata || {}
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[BalanceAudit] Failed to log balance change:', errorText);
        }
    } catch (error) {
        // Не прерываем основную операцию при ошибке логирования
        console.error('[BalanceAudit] Error logging balance change:', error);
    }
}

/**
 * Хелпер для обновления баланса с автоматическим логированием
 * Возвращает новый баланс
 */
export async function updateBalanceWithLog(
    userId: number,
    currentBalance: number,
    change: number,
    reason: BalanceChangeReason,
    referenceId?: string | number,
    metadata?: Record<string, unknown>
): Promise<number> {
    const newBalance = currentBalance + change;

    // Логируем изменение (не блокируем основную операцию)
    logBalanceChange({
        userId,
        oldBalance: currentBalance,
        newBalance,
        reason,
        referenceId,
        metadata
    }).catch(err => console.error('[BalanceAudit] Background log error:', err));

    return newBalance;
}

export interface SafeRefundParams {
    generationId: number;
    userId: number;
    amount: number;
    metadata?: Record<string, unknown>;
}

export interface SafeRefundResult {
    success: boolean;
    alreadyRefunded?: boolean;
    newBalance?: number;
    error?: string;
}

/**
 * Безопасный рефанд с защитой от двойного возврата
 * Использует флаг refunded в таблице generations
 */
export async function safeRefund(params: SafeRefundParams): Promise<SafeRefundResult> {
    const { generationId, userId, amount, metadata } = params;

    if (!generationId || !userId || amount <= 0) {
        return { success: false, error: 'Invalid params' };
    }

    try {
        // 1. Проверяем флаг refunded атомарно через PATCH с условием
        // Если генерация уже refunded=true, PATCH вернёт пустой массив
        const markResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/generations?id=eq.${generationId}&refunded=eq.false`,
            {
                method: 'PATCH',
                headers: {
                    ...supaHeaders(),
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ refunded: true })
            }
        );

        const markData = await markResponse.json().catch(() => []);

        // Если массив пустой — значит refunded уже был true
        if (!Array.isArray(markData) || markData.length === 0) {
            console.log(`[SafeRefund] Generation ${generationId} already refunded, skipping`);
            return { success: false, alreadyRefunded: true };
        }

        // 2. Получаем текущий баланс пользователя
        const balanceResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/users?user_id=eq.${userId}&select=balance`,
            { headers: supaHeaders() }
        );
        const balanceData = await balanceResponse.json().catch(() => []);
        const currentBalance = Array.isArray(balanceData) && balanceData[0]?.balance != null
            ? Number(balanceData[0].balance)
            : 0;

        // 3. Обновляем баланс
        const newBalance = currentBalance + amount;
        await fetch(
            `${SUPABASE_URL}/rest/v1/users?user_id=eq.${userId}`,
            {
                method: 'PATCH',
                headers: { ...supaHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ balance: newBalance })
            }
        );

        // 4. Логируем в audit
        logBalanceChange({
            userId,
            oldBalance: currentBalance,
            newBalance,
            reason: 'refund',
            referenceId: generationId,
            metadata: { ...metadata, protected: true }
        });

        console.log(`[SafeRefund] Refunded ${amount} to user ${userId}: ${currentBalance} -> ${newBalance}`);
        return { success: true, newBalance };

    } catch (error) {
        console.error('[SafeRefund] Error:', error);
        return { success: false, error: String(error) };
    }
}
