
const DEVICE_ID_KEY = 'watibot_device_id';

export function getDeviceId(): string {
    if (typeof window === 'undefined') return '';
    
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

export function getDeviceName(): string {
    if (typeof window === 'undefined') return 'Server';
    
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";
    else if (ua.indexOf("Edge") > -1) browser = "Edge";

    if (ua.indexOf("Win") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "macOS";
    else if (ua.indexOf("Linux") > -1) os = "Linux";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("like Mac") > -1) os = "iOS";

    return `${browser} on ${os}`;
}

export async function registerDevice() {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    try {
        await fetch('/api/manage/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, deviceName })
        });
    } catch (error) {
        console.error("Failed to register device:", error);
    }
}
