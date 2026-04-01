import fs from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import type { TemplateDelegate } from 'handlebars';
import { logger } from '@infrastructure/logger';
import { EMAIL_TEMPLATE_FILE_NAMES, EMAIL_TEMPLATE_SUBJECTS } from './email.constants';
import { parseEmailJobData } from './email.types';

type TemplateKey = keyof typeof EMAIL_TEMPLATE_FILE_NAMES;

const compiledTemplates = new Map<TemplateKey, TemplateDelegate>();

const getTemplatePath = (template: TemplateKey): string =>
    path.join(__dirname, 'templates', EMAIL_TEMPLATE_FILE_NAMES[template]);

const compileTemplate = (template: TemplateKey): TemplateDelegate => {
    const cached = compiledTemplates.get(template);

    if (cached) {
        return cached;
    }

    const source = fs.readFileSync(getTemplatePath(template), 'utf-8');
    const compiled = Handlebars.compile(source);
    compiledTemplates.set(template, compiled);

    return compiled;
};

export const preloadEmailTemplates = (): void => {
    const templates = Object.keys(EMAIL_TEMPLATE_FILE_NAMES) as TemplateKey[];

    templates.forEach((template) => {
        compileTemplate(template);
    });

    logger.info({ count: templates.length }, 'Email templates precompiled');
};

/**
 * Renders a template with the given data.
 * @param template The template key from EMAIL_TEMPLATE
 * @param payload The data to inject into the template
 */
export const renderTemplate = (template: TemplateKey, payload: unknown): { subject: string | null; html: string } => {
    const compiled = compileTemplate(template);

    return {
        subject: EMAIL_TEMPLATE_SUBJECTS[template] ?? null,
        html: compiled(payload),
    };
};

/**
 * Renders an email template from job data (used by the processor).
 */
export const renderEmailFromJob = (data: unknown): { subject: string; html: string } => {
    const payload = parseEmailJobData(data);
    const result = renderTemplate(payload.template, payload.payload);

    return {
        subject: result.subject ?? '',
        html: result.html,
    };
};
