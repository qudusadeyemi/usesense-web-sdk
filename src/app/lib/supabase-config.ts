/**
 * Supabase project configuration for the UseSense Web SDK.
 *
 * The gateway key is the Supabase anonymous key (public, non-secret).
 * It authenticates requests to the Supabase Edge Functions gateway layer.
 */

export const projectId = 'tzfsrqsjgxcpsxypxjof';

export const publicAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6ZnNycXNqZ3hjcHN4eXB4am9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMDQ5MjgsImV4cCI6MjA4Njc4MDkyOH0._PM_8RU9a6-l10mchYv5eipIhwWwt4gh8G1vdJgWcXw';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc4cf30d`;

export const GATEWAY_HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
};
