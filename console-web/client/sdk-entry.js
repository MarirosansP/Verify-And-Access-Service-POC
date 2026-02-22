/**
 * SDK entry point — bundled by esbuild into public/build/verification-sdk.js
 * This makes ConcordiumVerificationWebUI available on `window`.
 */
import { ConcordiumVerificationWebUI } from '@concordium/verification-web-ui';
import '@concordium/verification-web-ui/styles';

window.ConcordiumVerificationWebUI = ConcordiumVerificationWebUI;
