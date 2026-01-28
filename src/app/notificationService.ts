/**
 * MOMCAST Notification Service
 * Handles sending alerts to users (e.g., Alimtalk, SMS)
 */

export const sendDraftCompletionNotification = async (contactInfo: string, projectName: string) => {
    console.log(`[Notification] Sending draft completion alert to ${contactInfo} for project "${projectName}"`);

    // In a real implementation, you would call an external API like Aligo, Solapi, etc.
    // Example:
    // await fetch('https://api.notification-service.com/send', {
    //   method: 'POST',
    //   body: JSON.stringify({ to: contactInfo, message: `[MOMCAST] "${projectName}" 시안이 완료되었습니다. 보관함에서 확인해주세요!` })
    // });

    return true;
};

export const sendAdminOrderNotification = async (orderData: { requestId: string, projectName: string, userEmail: string, type: string }) => {
    console.log(`[Admin Notification] New high-priority order! Project: "${orderData.projectName}" by ${orderData.userEmail} (${orderData.type})`);

    // In a real implementation:
    // 1. Send email to admin (e.g., using SendGrid, Resend, or Nodemailer)
    // 2. Alert in Slack/Discord

    // Simulation:
    // await fetch('/api/admin/notify', { method: 'POST', body: JSON.stringify(orderData) });

    return true;
};
