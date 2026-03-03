import crypto from 'crypto';
import axios, { AxiosRequestConfig } from 'axios';

const SUMSUB_BASE_URL = 'https://api.sumsub.com';
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || '';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '';

/**
 * Create HMAC signature for Sumsub API requests
 */
function createSignature(ts: number, httpMethod: string, url: string, body?: string): string {
  const hmac = crypto.createHmac('sha256', SUMSUB_SECRET_KEY);
  hmac.update(ts + httpMethod.toUpperCase() + url);
  if (body) {
    hmac.update(body);
  }
  return hmac.digest('hex');
}

/**
 * Make an authenticated request to Sumsub API
 */
async function sumsubRequest(method: string, path: string, body?: any) {
  const ts = Math.floor(Date.now() / 1000);
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const signature = createSignature(ts, method, path, bodyStr);

  const config: AxiosRequestConfig = {
    method,
    url: `${SUMSUB_BASE_URL}${path}`,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts.toString(),
    },
    data: bodyStr,
  };

  const response = await axios(config);
  return response.data;
}

/**
 * Create or get an applicant in Sumsub
 */
export async function createApplicant(externalUserId: string, levelName: string = 'id-and-liveness') {
  try {
    // Try to get existing applicant first
    const existing = await getApplicantByExternalId(externalUserId);
    if (existing) {
      return existing;
    }
  } catch {
    // Applicant doesn't exist, create new one
  }

  const body = {
    externalUserId,
    levelName,
  };

  return sumsubRequest('POST', '/resources/applicants?levelName=' + encodeURIComponent(levelName), body);
}

/**
 * Get applicant by external user ID
 */
export async function getApplicantByExternalId(externalUserId: string) {
  try {
    const result = await sumsubRequest('GET', `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`);
    return result;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Generate an access token for the Sumsub Web SDK
 */
export async function generateAccessToken(externalUserId: string, levelName: string = 'id-and-liveness') {
  // Ensure applicant exists first
  await createApplicant(externalUserId, levelName);

  const ts = Math.floor(Date.now() / 1000);
  const path = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(levelName)}`;
  const signature = createSignature(ts, 'POST', path);

  const response = await axios({
    method: 'POST',
    url: `${SUMSUB_BASE_URL}${path}`,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts.toString(),
    },
  });

  return response.data;
}

/**
 * Get applicant verification status from Sumsub
 */
export async function getApplicantStatus(applicantId: string) {
  return sumsubRequest('GET', `/resources/applicants/${applicantId}/requiredIdDocsStatus`);
}

/**
 * Check applicant review status directly from Sumsub (by externalUserId)
 * This is used as a fallback when webhooks aren't configured
 */
export async function checkApplicantReviewStatus(externalUserId: string): Promise<'NOT_STARTED' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED'> {
  try {
    const applicant = await getApplicantByExternalId(externalUserId);
    if (!applicant) {
      return 'NOT_STARTED';
    }

    // Get the review status
    const reviewStatus = applicant.review?.reviewStatus;
    const reviewAnswer = applicant.review?.reviewResult?.reviewAnswer;

    if (reviewAnswer === 'GREEN') {
      return 'VERIFIED';
    } else if (reviewAnswer === 'RED') {
      return 'REJECTED';
    } else if (reviewStatus === 'pending' || reviewStatus === 'queued' || reviewStatus === 'onHold') {
      return 'IN_REVIEW';
    } else if (reviewStatus === 'completed' || reviewStatus === 'completedSent') {
      // Completed but no GREEN answer means rejected
      return reviewAnswer ? 'REJECTED' : 'IN_REVIEW';
    }

    return 'IN_REVIEW';
  } catch (error) {
    console.error('[Sumsub] Error checking review status:', error);
    return 'IN_REVIEW';
  }
}

/**
 * Verify Sumsub webhook signature
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.SUMSUB_WEBHOOK_SECRET || '';
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Map Sumsub review result to our KYC status
 */
export function mapReviewResultToKycStatus(reviewResult: any): 'VERIFIED' | 'REJECTED' {
  if (reviewResult?.reviewAnswer === 'GREEN') {
    return 'VERIFIED';
  }
  return 'REJECTED';
}
