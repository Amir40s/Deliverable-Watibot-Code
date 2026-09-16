export const requestNotificationPermission = (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve('denied');
  }

  try {
    const res = Notification.requestPermission();
    if (res && typeof res.then === 'function') {
      return res;
    }
  } catch (e) {
    // Ignore error and fall back to callback method
  }

  return new Promise<NotificationPermission>((resolve) => {
    try {
      Notification.requestPermission(resolve);
    } catch (e) {
      resolve('denied');
    }
  });
};
