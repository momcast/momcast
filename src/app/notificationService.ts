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
