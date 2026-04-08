interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare function initEmailService(): void;
export declare function sendEmail(options: SendEmailOptions): Promise<boolean>;
export declare function sendOTPEmail(to: string, otp: string): Promise<boolean>;
export declare function isEmailConfigured(): boolean;
export {};
