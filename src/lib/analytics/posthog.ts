import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://app.posthog.com";

const DOC_VIEW_EVENT = "docs_page_viewed";

let initialized = false;

export const initPosthog = () => {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: false,
  });
  initialized = true;
};

export const identifyPosthog = (payload: {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  organizationId?: string | null;
}) => {
  if (!POSTHOG_KEY) return;
  initPosthog();
  posthog.identify(payload.userId, {
    email: payload.email ?? undefined,
    name: payload.fullName ?? undefined,
    organization_id: payload.organizationId ?? undefined,
  });
};

export const resetPosthog = () => {
  if (!POSTHOG_KEY) return;
  initPosthog();
  posthog.reset();
};

export const captureDocView = (payload: {
  documentId: string;
  documentTitle?: string | null;
  documentSlug?: string | null;
  projectId: string;
  projectSlug?: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
  visibility?: string | null;
  isInternalView?: boolean;
}) => {
  if (!POSTHOG_KEY) return;
  initPosthog();
  posthog.capture(DOC_VIEW_EVENT, {
    document_id: payload.documentId,
    document_title: payload.documentTitle ?? undefined,
    document_slug: payload.documentSlug ?? undefined,
    project_id: payload.projectId,
    project_slug: payload.projectSlug ?? undefined,
    organization_id: payload.organizationId ?? undefined,
    organization_slug: payload.organizationSlug ?? undefined,
    visibility: payload.visibility ?? undefined,
    is_internal: payload.isInternalView ?? false,
  });
};

export const getPosthogEventName = () => DOC_VIEW_EVENT;
