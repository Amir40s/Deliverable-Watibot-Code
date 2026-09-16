import PusherClient from 'pusher-js';

// Client-side Pusher helper
export const getPusherClient = (key: string, cluster: string) => {
  return new PusherClient(key, {
    cluster: cluster,
  });
};
