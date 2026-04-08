const otpStore = new Map();
export function generateOTP(email) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { code, expiresAt });
    return code;
}
export function verifyOTP(email, code) {
    const record = otpStore.get(email);
    if (!record)
        return false;
    if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return false;
    }
    const isValid = record.code === code;
    if (isValid)
        otpStore.delete(email);
    return isValid;
}
export function getOTP(email) {
    const record = otpStore.get(email);
    if (!record || Date.now() > record.expiresAt) {
        if (record)
            otpStore.delete(email);
        return null;
    }
    return record.code;
}
