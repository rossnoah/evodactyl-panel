/**
 * Notification sent when a user is removed as a subuser from a server.
 * Mirrors the notification concept from Laravel.
 *
 * In production, this would integrate with an email service (e.g., nodemailer).
 */
export interface RemovedFromServerNotification {
  serverName: string;
  userEmail: string;
}

/**
 * Send a notification that a user has been removed from a server.
 */
export async function sendRemovedFromServerNotification(
  data: RemovedFromServerNotification
): Promise<void> {
  // In production, send via email/notification service
  console.log(
    `[Notification] User ${data.userEmail} has been removed as a subuser from server "${data.serverName}".`
  );
}
