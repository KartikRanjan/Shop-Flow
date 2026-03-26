import fs from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import type { TemplateDelegate } from 'handlebars';
import { logger } from '@infrastructure/logger';
import { EMAIL_TEMPLATE_FILE_NAMES, EMAIL_TEMPLATE_SUBJECTS } from './email.constants';
import type { EmailJobData } from './email.types';
import { parseEmailJobData } from './email.types';

type EmailTemplate = EmailJobData['template'];

const compiledTemplates = new Map<EmailTemplate, TemplateDelegate>();

const getTemplatePath = (template: EmailTemplate): string =>
    path.join(__dirname, 'templates', EMAIL_TEMPLATE_FILE_NAMES[template]);

const compileTemplate = (template: EmailTemplate): TemplateDelegate => {
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
    const templates = Object.keys(EMAIL_TEMPLATE_FILE_NAMES) as EmailTemplate[];

    templates.forEach((template) => {
        compileTemplate(template);
    });

    logger.info({ count: templates.length }, 'Email templates precompiled');
};

export const renderTemplate = (data: unknown): { subject: string; html: string } => {
    const payload = parseEmailJobData(data);
    const compiled = compileTemplate(payload.template);

    return {
        subject: EMAIL_TEMPLATE_SUBJECTS[payload.template],
        html: compiled(payload.payload),
    };
};
