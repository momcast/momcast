/**
 * MOMCAST Payment Service
 * Mock integration for Naver Pay
 */

export interface PaymentRequest {
    amount: number;
    orderName: string;
    successUrl: string;
    failUrl: string;
}

export const requestNaverPay = async (params: PaymentRequest): Promise<boolean> => {
    console.log(`[Payment] Initializing Naver Pay for "${params.orderName}" (Amount: ${params.amount} KRW)`);

    // In a real implementation:
    // 1. Call Naver Pay API to create an order
    // 2. Open Naver Pay window
    // 3. User approves
    // 4. Verification

    // Simulation:
    return new Promise((resolve) => {
        const confirmPay = window.confirm(`[네이버페이 시뮬레이션]\n\n상품명: ${params.orderName}\n결제금액: ${params.amount}원\n\n결제를 진행하시겠습니까?`);
        if (confirmPay) {
            console.log('✅ 결제 성공');
            resolve(true);
        } else {
            console.log('❌ 결제 취소');
            resolve(false);
        }
    });
};
