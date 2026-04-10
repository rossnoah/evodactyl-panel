/**
 * Notification sent when a user is added as a subuser to a server.
 * Mirrors the notification concept from Laravel.
 *
 * In production, this would integrate with an email service (e.g., nodemailer).
 */
export interface AddedToServerNotification {
  serverName: string;
  userEmail: string;
}

/**
 * Send a notification that a user has been added to a server as a subuser.
 */
export async function sendAddedToServerNotification(
  data: AddedToServerNotification
): Promise<void> {
  // In production, send via email/notification service
  console.log(
    `[Notification] User ${data.userEmail} has been added as a subuser to server "${data.serverName}".`
  );
}
