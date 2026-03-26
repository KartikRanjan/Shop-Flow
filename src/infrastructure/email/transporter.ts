import nodemailer from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@infrastructure/logger';

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
        env.SMTP_USER && env.SMTP_PASS
            ? {
                  user: env.SMTP_USER,
                  pass: env.SMTP_PASS,
              }
            : undefined,
});

export async function sendEmail(options: SendEmailOptions): Promise<void> {
    try {
        const info = await transporter.sendMail({
            from: env.SMTP_FROM,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        });

        logger.info({ messageId: info.messageId, to: options.to }, 'Email sent successfully');
    } catch (error) {
        logger.error({ error, to: options.to }, 'Failed to send email');
        throw error;
    }
}
