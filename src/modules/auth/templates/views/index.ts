/**
 * Auth View Renderers
 * @module auth/templates/views
 * @description View-specific render functions for auth browser pages.
 */

import path from 'node:path';
import { env } from '@config/env';
import { renderView } from '../../utils';

export type VerificationResultViewModel = {
    title: string;
    header: string;
    message: string;
    isSuccess: boolean;
    buttonText: string;
    buttonUrl: string;
};

const VERIFICATION_RESULT_TEMPLATE = path.join(__dirname, 'verification-result.hbs');

/**
 * Maps verification results to a rich view model for the template.
 */
export const renderVerificationResult = (success: boolean, errorMessage?: string): string => {
    const viewModel: VerificationResultViewModel = success
        ? {
              title: 'Email Verified Successfully - ShopFlow',
              header: 'Email Verified!',
              message:
                  'Your email address has been successfully verified. You can now log in to your ShopFlow account.',
              isSuccess: true,
              buttonText: 'Continue to Login',
              buttonUrl: `${env.CLIENT_URL}/login`,
          }
        : {
              title: 'Verification Error - ShopFlow',
              header: 'Verification Failed',
              message: errorMessage ?? 'An unexpected error occurred during verification.',
              isSuccess: false,
              buttonText: 'Return to Home',
              buttonUrl: env.CLIENT_URL,
          };

    return renderView(VERIFICATION_RESULT_TEMPLATE, viewModel);
};
